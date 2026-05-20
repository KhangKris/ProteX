import MDAnalysis as mda
import numpy as np
from scipy.spatial.distance import cdist
from typing import List, Dict, Any

# Disulfide bond S-S distance is ~2.05 Å; allow up to 2.5 Å for structural noise
DISULFIDE_CUTOFF = 2.5

def detect_disulfide_bonds(u: mda.Universe, cutoff: float = DISULFIDE_CUTOFF) -> List[Dict[str, Any]]:
    """
    Detects disulfide bonds (CYS–CYS covalent S–S linkages) in a protein structure.

    Algorithm:
    1. Select all SG (sulfur gamma) atoms of cysteine residues.
    2. Compute pairwise Euclidean distances using SciPy cdist.
    3. Flag pairs with distance ≤ cutoff (default 2.5 Å) as disulfide bonds.

    Parameters:
    - u: MDAnalysis Universe object
    - cutoff: S–S distance threshold in Angstroms (default: 2.5)

    Returns:
    - List of dicts, each describing one disulfide bond.
    """
    # Select sulfur gamma atoms of CYS
    sg_atoms = u.select_atoms("resname CYS and name SG")

    results = []

    if len(sg_atoms) < 2:
        return results

    # Compute pairwise distances
    positions = sg_atoms.positions
    dists = cdist(positions, positions)

    # Only upper triangle (avoid double counting and self-pairs)
    n = len(sg_atoms)
    for i in range(n):
        for j in range(i + 1, n):
            dist = float(dists[i, j])
            if dist <= cutoff:
                atom_i = sg_atoms[i]
                atom_j = sg_atoms[j]
                res_i = atom_i.residue
                res_j = atom_j.residue

                results.append({
                    "id": f"ss_{atom_i.id}_{atom_j.id}",
                    "distance": round(dist, 3),
                    "residue_a": {
                        "name": res_i.resname,
                        "number": int(res_i.resid),
                        "chain": str(res_i.segid) if hasattr(res_i, "segid") else "A",
                    },
                    "atom_a": {
                        "id": int(atom_i.id),
                        "name": str(atom_i.name),
                        "coordinates": [float(x) for x in atom_i.position],
                    },
                    "residue_b": {
                        "name": res_j.resname,
                        "number": int(res_j.resid),
                        "chain": str(res_j.segid) if hasattr(res_j, "segid") else "A",
                    },
                    "atom_b": {
                        "id": int(atom_j.id),
                        "name": str(atom_j.name),
                        "coordinates": [float(x) for x in atom_j.position],
                    },
                })

    results.sort(key=lambda x: x["distance"])
    return results
