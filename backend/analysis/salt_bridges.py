import MDAnalysis as mda
import numpy as np
from scipy.spatial.distance import cdist
from typing import List, Dict, Any

def detect_salt_bridges(u: mda.Universe, cutoff: float = 4.0) -> List[Dict[str, Any]]:
    """
    Detects electrostatic interactions (salt bridges) in a protein structure.
    
    Algorithm:
    1. Select positively charged Nitrogen atoms:
       - LYS: NZ
       - ARG: NH1, NH2
    2. Select negatively charged Oxygen atoms:
       - ASP: OD1, OD2
       - GLU: OE1, OE2
    3. Compute Euclidean distance between all positive and negative pairs.
    4. If distance < cutoff (default 4.0 A), classify as a salt bridge.
    
    Parameters:
    - u: MDAnalysis Universe object
    - cutoff: Distance threshold in Angstroms (default: 4.0)
    
    Returns:
    - List of dicts representing each detected salt bridge.
    """
    # 1. Define selection queries
    pos_query = "(resname LYS and name NZ) or (resname ARG and (name NH1 or name NH2))"
    neg_query = "(resname ASP and (name OD1 or name OD2)) or (resname GLU and (name OE1 or name OE2))"
    
    # 2. Select atoms
    pos_atoms = u.select_atoms(pos_query)
    neg_atoms = u.select_atoms(neg_query)
    
    salt_bridges = []
    
    if len(pos_atoms) == 0 or len(neg_atoms) == 0:
        return salt_bridges
        
    # 3. Compute pairwise distances using SciPy
    # pos_atoms.positions has shape (N, 3), neg_atoms.positions has shape (M, 3)
    distances = cdist(pos_atoms.positions, neg_atoms.positions)
    
    # Find indices where distance is less than the cutoff
    pos_indices, neg_indices = np.where(distances < cutoff)
    
    # 4. Process and format results
    for p_idx, n_idx in zip(pos_indices, neg_indices):
        pos_atom = pos_atoms[p_idx]
        neg_atom = neg_atoms[n_idx]
        distance = float(distances[p_idx, n_idx])
        
        # Extract residue info
        pos_res = pos_atom.residue
        neg_res = neg_atom.residue
        
        # Build coordinates as list of floats
        pos_coord = [float(c) for c in pos_atom.position]
        neg_coord = [float(c) for c in neg_atom.position]
        
        salt_bridge = {
            "id": f"sb_{pos_atom.id}_{neg_atom.id}",
            "distance": round(distance, 3),
            
            # Positive partner details
            "positive_residue": {
                "name": pos_res.resname,
                "number": int(pos_res.resid),
                "chain": str(pos_res.segid) if hasattr(pos_res, 'segid') else "A"
            },
            "positive_atom": {
                "id": int(pos_atom.id),
                "name": str(pos_atom.name),
                "coordinates": pos_coord
            },
            
            # Negative partner details
            "negative_residue": {
                "name": neg_res.resname,
                "number": int(neg_res.resid),
                "chain": str(neg_res.segid) if hasattr(neg_res, 'segid') else "A"
            },
            "negative_atom": {
                "id": int(neg_atom.id),
                "name": str(neg_atom.name),
                "coordinates": neg_coord
            }
        }
        
        salt_bridges.append(salt_bridge)
        
    # Sort salt bridges by distance
    salt_bridges.sort(key=lambda x: x["distance"])
    return salt_bridges
