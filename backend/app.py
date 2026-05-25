import os
import uuid
import json
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

from analysis import (
    parse_structure, get_structure_metadata,
    detect_salt_bridges, detect_hydrogen_bonds,
    detect_disulfide_bonds, detect_pi_stacking, detect_hydrophobic_contacts,
    enrich_interactions
)
from analysis.pipeline import run_high_precision_pipeline
from analysis.utils import cleanup_uploads_dir
from nim_client import NIMClient, NIMError

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_backend")

# Initialize directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize NIM client
nim = NIMClient()

app = FastAPI(
    title="Protein Interaction Visualization API",
    description="Backend API for parsing PDB/mmCIF files, predicting structures via OpenFold 3, and analyzing interactions",
    version="2.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request Models ───────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    file_id: str

class MoleculeInput(BaseModel):
    type: str = Field(..., description="protein | dna | rna | ligand")
    sequence: Optional[str] = Field(None, description="Amino acid or nucleotide sequence")
    id: Optional[str] = Field(None, description="Chain ID (1-4 chars)")
    smiles: Optional[str] = Field(None, description="SMILES string (ligand only)")
    ccd_codes: Optional[List[str]] = Field(None, description="CCD codes (ligand only)")

class PredictRequest(BaseModel):
    molecules: List[MoleculeInput]
    output_format: str = "pdb"

# ── Helpers ──────────────────────────────────────────────────────────────────

def get_file_path_and_ext(file_id: str) -> tuple[str, str]:
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id) and not filename.endswith("_results.json"):
            name, ext = os.path.splitext(filename)
            if name == file_id:
                return os.path.join(UPLOAD_DIR, filename), ext
    raise HTTPException(status_code=404, detail="Structure file not found")


def run_full_analysis(file_path: str, file_id: str) -> dict:
    """Run the complete interaction analysis pipeline on a structure file."""
    u = parse_structure(file_path)
    metadata = get_structure_metadata(u)
    metadata["file_id"] = file_id

    salt_bridges = detect_salt_bridges(u)
    hbond_results = detect_hydrogen_bonds(u, d_a_cutoff=3.2)
    disulfide_bonds = detect_disulfide_bonds(u)
    pi_stacking = detect_pi_stacking(u)
    hydrophobic_contacts = detect_hydrophobic_contacts(u)

    hydrogen_bonds = hbond_results.get("hydrogen_bonds", [])

    # Enrich with energy estimates (our value-add over OpenFold 3)
    enrich_interactions(
        salt_bridges, hydrogen_bonds,
        disulfide_bonds, pi_stacking, hydrophobic_contacts
    )

    logger.info(
        f"Analysis complete: HB={len(hydrogen_bonds)}, SB={len(salt_bridges)}, "
        f"SS={len(disulfide_bonds)}, PI={len(pi_stacking)}, HC={len(hydrophobic_contacts)}"
    )

    return {
        "hydrogen_bonds": hydrogen_bonds,
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


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Protein Interaction API is running",
        "nim_configured": nim.is_configured(),
    }

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    
    if ext not in [".pdb", ".cif", ".mmcif"]:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Only .pdb, .cif, and .mmcif files are supported."
        )
    
    file_id = str(uuid.uuid4())
    save_filename = f"{file_id}{ext}"
    save_path = os.path.join(UPLOAD_DIR, save_filename)
    
    try:
        with open(save_path, "wb") as buffer:
            shutil_block = await file.read()
            buffer.write(shutil_block)
            
        logger.info(f"Saved file {filename} to {save_path}")
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

    cache_path = os.path.join(UPLOAD_DIR, f"{file_id}_results.json")
    if not refresh and os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cached_data = json.load(f)
            if "disulfide_bonds" in cached_data:
                logger.info(f"Returning cached analysis for {file_id}")
                return cached_data
        except Exception:
            pass

    try:
        response_data = run_full_analysis(file_path, file_id)

        with open(cache_path, "w") as f:
            json.dump(response_data, f, indent=2)

        return response_data

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── NEW: Structure Prediction via NVIDIA NIM ─────────────────────────────────

@app.post("/predict")
async def predict_structure(payload: PredictRequest):
    """
    Predict 3D structure from sequences using NVIDIA NIM OpenFold 3,
    then run the full interaction analysis pipeline.

    Input: List of molecules (protein, DNA, RNA, ligand sequences)
    Output: file_id + interaction analysis + confidence scores
    """
    if not nim.is_configured():
        raise HTTPException(
            status_code=503,
            detail="NVIDIA NIM API key not configured. Set NVIDIA_API_KEY in backend/.env"
        )

    # Convert Pydantic models to dicts for NIM client
    molecules = [mol.dict(exclude_none=True) for mol in payload.molecules]

    # Validate: at least one molecule with a sequence
    if not molecules:
        raise HTTPException(status_code=400, detail="At least one molecule is required")

    for mol in molecules:
        mol_type = mol.get("type", "")
        if mol_type in ("protein", "dna", "rna") and not mol.get("sequence"):
            raise HTTPException(status_code=400, detail=f"{mol_type} molecule requires a sequence")
        if mol_type == "ligand" and not mol.get("smiles") and not mol.get("ccd_codes"):
            raise HTTPException(status_code=400, detail="Ligand requires smiles or ccd_codes")

    file_id = str(uuid.uuid4())
    ext = f".{payload.output_format}"

    try:
        # 1. Call NVIDIA NIM OpenFold 3
        logger.info(f"Predicting structure for {len(molecules)} molecule(s)...")
        nim_result = nim.predict(
            molecules=molecules,
            request_id=file_id,
            output_format=payload.output_format,
        )

        structure_content = nim_result["structure"]
        if not structure_content:
            raise HTTPException(status_code=500, detail="NIM returned empty structure")

        # 2. Save predicted structure as a PDB/CIF file
        save_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        with open(save_path, "w") as f:
            f.write(structure_content)
        logger.info(f"Saved predicted structure to {save_path}")

        # 3. Run full interaction analysis on the predicted structure
        analysis_data = run_full_analysis(save_path, file_id)

        # 4. Add prediction confidence scores to metadata
        analysis_data["metadata"]["prediction_source"] = "nvidia_nim_openfold3"
        analysis_data["metadata"]["confidence_score"] = nim_result["confidence_score"]
        analysis_data["metadata"]["complex_plddt_score"] = nim_result["complex_plddt_score"]
        analysis_data["metadata"]["complex_pde_score"] = nim_result["complex_pde_score"]
        analysis_data["metadata"]["ptm_score"] = nim_result["ptm_score"]
        analysis_data["metadata"]["iptm_score"] = nim_result["iptm_score"]
        analysis_data["metadata"]["input_molecules"] = molecules

        # 5. Cache results
        cache_path = os.path.join(UPLOAD_DIR, f"{file_id}_results.json")
        with open(cache_path, "w") as f:
            json.dump(analysis_data, f, indent=2)

        return {
            "file_id": file_id,
            "extension": ext,
            "status": "predicted",
            "analysis": analysis_data,
        }

    except NIMError as ne:
        logger.error(f"NIM API error: {ne}")
        raise HTTPException(status_code=ne.status_code, detail=ne.detail)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/analyze-high-precision")
async def analyze_file_high_precision(payload: AnalyzeRequest, ph: float = 7.0):
    file_id = payload.file_id
    file_path, ext = get_file_path_and_ext(file_id)
    
    try:
        results = run_high_precision_pipeline(file_path, ph=ph)
        if results is None:
             raise HTTPException(status_code=500, detail="High-precision analysis failed.")
        
        return {
            "file_id": file_id,
            "analysis": results,
            "method": "PDB2PQR + MDTraj"
        }
    except Exception as e:
        logger.error(f"High-precision analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/results/{id}")
async def get_results(id: str):
    cache_path = os.path.join(UPLOAD_DIR, f"{id}_results.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading cache {cache_path}: {str(e)}")
            
    try:
        return await analyze_file(AnalyzeRequest(file_id=id))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve or run analysis: {str(e)}")

@app.get("/files/{id}")
async def get_file(id: str):
    try:
        file_path, _ = get_file_path_and_ext(id)
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
