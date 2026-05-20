import os
import uuid
import json
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any

from analysis import (
    parse_structure, get_structure_metadata,
    detect_salt_bridges, detect_hydrogen_bonds,
    detect_disulfide_bonds, detect_pi_stacking, detect_hydrophobic_contacts
)
from analysis.utils import cleanup_uploads_dir

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_backend")

# Initialize directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Protein Interaction Visualization API",
    description="Backend API for parsing PDB/mmCIF files and analyzing interactions",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    file_id: str

def get_file_path_and_ext(file_id: str) -> tuple[str, str]:
    """
    Finds the file in the upload directory and returns its full path and extension.
    """
    # Check all files in UPLOAD_DIR starting with the file_id
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id) and not filename.endswith("_results.json"):
            name, ext = os.path.splitext(filename)
            if name == file_id:
                return os.path.join(UPLOAD_DIR, filename), ext
    raise HTTPException(status_code=404, detail="Structure file not found")

@app.get("/")
async def root():
    return {"status": "ok", "message": "Protein Interaction API is running"}

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Validate extension
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    
    if ext not in [".pdb", ".cif", ".mmcif"]:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Only .pdb, .cif, and .mmcif files are supported."
        )
    
    # Generate unique ID
    file_id = str(uuid.uuid4())
    save_filename = f"{file_id}{ext}"
    save_path = os.path.join(UPLOAD_DIR, save_filename)
    
    try:
        # Save file to uploads folder
        with open(save_path, "wb") as buffer:
            shutil_block = await file.read()
            buffer.write(shutil_block)
            
        logger.info(f"Saved file {filename} to {save_path}")
        
        # Trigger background cleanup of old files if they exceed a limit
        background_tasks.add_task(cleanup_uploads_dir, UPLOAD_DIR, 50)
        
        return {
            "file_id": file_id,
            "filename": filename,
            "extension": ext,
            "status": "uploaded"
        }
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@app.post("/analyze")
async def analyze_file(payload: AnalyzeRequest, refresh: bool = False):
    file_id = payload.file_id
    file_path, ext = get_file_path_and_ext(file_id)

    # If results are already cached (and not forcing refresh), return them
    cache_path = os.path.join(UPLOAD_DIR, f"{file_id}_results.json")
    if not refresh and os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cached_data = json.load(f)
            # Only use cache if it has the extended fields (new format)
            if "disulfide_bonds" in cached_data:
                logger.info(f"Returning cached analysis for {file_id}")
                return cached_data
            else:
                logger.info(f"Cache is old format (missing disulfide_bonds), re-running analysis.")
        except Exception:
            logger.warning(f"Failed to read cache file {cache_path}. Re-running analysis.")

    # Perform analysis
    try:
        logger.info(f"Starting analysis for file: {file_path}")
        u = parse_structure(file_path)

        # Extract metadata
        metadata = get_structure_metadata(u)
        metadata["file_id"] = file_id

        # 1. Salt Bridge Detection
        salt_bridges = detect_salt_bridges(u)
        logger.info(f"Salt bridges detected: {len(salt_bridges)}")

        # 2. Hydrogen Bond Detection (tighter 3.2 Å fallback cutoff for better accuracy)
        hbond_results = detect_hydrogen_bonds(u, d_a_cutoff=3.2)
        logger.info(f"Hydrogen bonds detected: {hbond_results.get('count', 0)} via {hbond_results.get('method')}")

        # 3. Disulfide Bond Detection
        disulfide_bonds = detect_disulfide_bonds(u)
        logger.info(f"Disulfide bonds detected: {len(disulfide_bonds)}")

        # 4. Pi-Pi Stacking Detection
        pi_stacking = detect_pi_stacking(u)
        logger.info(f"Pi-pi stacking interactions detected: {len(pi_stacking)}")

        # 5. Hydrophobic Contact Detection
        hydrophobic_contacts = detect_hydrophobic_contacts(u)
        logger.info(f"Hydrophobic contacts detected: {len(hydrophobic_contacts)}")

        response_data = {
            "hydrogen_bonds": hbond_results.get("hydrogen_bonds", []),
            "salt_bridges": salt_bridges,
            "disulfide_bonds": disulfide_bonds,
            "pi_stacking": pi_stacking,
            "hydrophobic_contacts": hydrophobic_contacts,
            "metadata": {
                **metadata,
                "hbond_method": hbond_results.get("method"),
                "hbond_warning": hbond_results.get("warning", None),
                "salt_bridge_count": len(salt_bridges),
                "hbond_count": hbond_results.get("count", 0),
                "disulfide_bond_count": len(disulfide_bonds),
                "pi_stacking_count": len(pi_stacking),
                "hydrophobic_contact_count": len(hydrophobic_contacts),
            }
        }

        # Cache results
        with open(cache_path, "w") as f:
            json.dump(response_data, f, indent=2)

        logger.info(f"Completed analysis and saved cache for {file_id}")
        return response_data

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed during processing: {str(e)}"
        )

@app.get("/results/{id}")
async def get_results(id: str):
    cache_path = os.path.join(UPLOAD_DIR, f"{id}_results.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading cache {cache_path}: {str(e)}")
            
    # If not cached, try to compute on the fly
    try:
        return await analyze_file(AnalyzeRequest(file_id=id))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve or run analysis: {str(e)}")

@app.get("/files/{id}")
async def get_file(id: str):
    """
    Serves the actual PDB or mmCIF structure file.
    This is required by the Mol* frontend to load the structure.
    """
    try:
        file_path, _ = get_file_path_and_ext(id)
        # Suggest download filename
        original_name = f"structure_{id[:8]}.pdb" if file_path.endswith(".pdb") else f"structure_{id[:8]}.cif"
        return FileResponse(
            path=file_path,
            media_type="application/octet-stream",
            filename=original_name
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve structure file: {str(e)}")
