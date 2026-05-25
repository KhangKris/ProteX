import subprocess
import os
import mdtraj as md
from pathlib import Path

# Placeholder paths (adjust as needed for deployment)
PDB2PQR_PATH = "pdb2pqr"  # Assumes globally installed/in path

def run_pdb2pqr(input_pdb: str, output_pdb: str, ph: float = 7.0) -> bool:
    """
    Run PDB2PQR to add missing hydrogen atoms based on pH.
    """
    try:
        # Command: pdb2pqr --pH <ph> <input> <output>
        cmd = [PDB2PQR_PATH, "--pH", str(ph), input_pdb, output_pdb]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"PDB2PQR Error: {e.stderr}")
        return False

def analyze_hydrogen_bonds(pdb_path: str):
    """
    Use MDTraj to extract precise H-bond data from a structured PDB.
    """
    try:
        traj = md.load(pdb_path)
        # MDTraj's wernet_nilsson is a robust H-bond detector
        hbonds = md.baker_hubbard(traj, periodic=False)
        
        # Format the output to match our expected API schema
        formatted_hbonds = []
        for hb in hbonds:
            # hb is (donor_idx, H_idx, acceptor_idx)
            formatted_hbonds.append({
                "donor_idx": int(hb[0]),
                "hydrogen_idx": int(hb[1]),
                "acceptor_idx": int(hb[2]),
                # Additional metrics extraction would go here
            })
            
        return formatted_hbonds
    except Exception as e:
        print(f"MDTraj Analysis Error: {e}")
        return []

def run_high_precision_pipeline(pdb_path: str, ph: float = 7.0):
    """
    Orchestrate the full pipeline.
    """
    output_pdb = pdb_path.replace(".pdb", "_h.pdb")
    
    if run_pdb2pqr(pdb_path, output_pdb, ph):
        return analyze_hydrogen_bonds(output_pdb)
    else:
        return None
