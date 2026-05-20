import MDAnalysis as mda
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def parse_structure(file_path: str) -> mda.Universe:
    """
    Loads a PDB or mmCIF file into an MDAnalysis Universe.
    
    Parameters:
    - file_path: Path to the structural file (.pdb or .cif/.mmcif).
    
    Returns:
    - MDAnalysis.Universe object.
    """
    try:
        # MDAnalysis guesses format from the file extension (PDB, MMtf, CIF, etc.)
        u = mda.Universe(file_path)
        logger.info(f"Loaded structure from {file_path} with {len(u.atoms)} atoms and {len(u.residues)} residues.")
        return u
    except Exception as e:
        logger.error(f"Error parsing structure {file_path}: {str(e)}")
        raise ValueError(f"Could not parse structure file: {str(e)}")

def get_structure_metadata(u: mda.Universe) -> Dict[str, Any]:
    """
    Extracts high-level metadata from the loaded Universe.
    """
    try:
        # Extract basic info
        num_atoms = len(u.atoms)
        num_residues = len(u.residues)
        num_segments = len(u.segments)
        
        # Get list of unique residues
        unique_resnames = list(set(u.residues.resnames))
        
        # Count protein vs non-protein atoms if possible
        protein_atoms = u.select_atoms("protein")
        num_protein_atoms = len(protein_atoms)
        num_protein_residues = len(protein_atoms.residues)
        
        return {
            "num_atoms": num_atoms,
            "num_residues": num_residues,
            "num_segments": num_segments,
            "num_protein_atoms": num_protein_atoms,
            "num_protein_residues": num_protein_residues,
            "unique_residues": unique_resnames,
        }
    except Exception as e:
        logger.error(f"Error getting metadata: {str(e)}")
        return {
            "num_atoms": len(u.atoms),
            "num_residues": len(u.residues),
            "error": f"Failed to extract full metadata: {str(e)}"
        }
