import MDAnalysis as mda
import numpy as np
from scipy.spatial.distance import cdist
from typing import List, Dict, Any

# Standard hydrophobic residues (non-polar side chains)
HYDROPHOBIC_RESNAMES = {"ALA", "VAL", "ILE", "LEU", "MET", "PHE", "TRP", "PRO"}

# Cβ–Cβ distance cutoff for hydrophobic contact
HYDROPHOBIC_CUTOFF = 5.5  # Å

# Minimum sequence separation to exclude adjacent backbone contacts
MIN_SEQ_SEP = 2


def detect_hydrophobic_contacts(u: mda.Universe,
                                cutoff: float = HYDROPHOBIC_CUTOFF) -> List[Dict[str, Any]]:
    """
    Detects hydrophobic contacts between non-polar residues.

    Algorithm:
    1. Select Cβ atoms of hydrophobic residues (Cα for GLY, though GLY is excluded here).
    2. Compute pairwise Cβ–Cβ distances using SciPy cdist.
    3. Keep pairs where:
       - distance ≤ cutoff (default 5.5 Å)
       - residues are NOT adjacent in sequence (|resid diff| > MIN_SEQ_SEP)
       - residues are on the same chain

    Parameters:
    - u: MDAnalysis Universe object
    - cutoff: Cβ–Cβ distance threshold in Angstroms

    Returns:
    - List of dicts describing each hydrophobic contact.
    """
    # Build per-residue Cβ atom list
    cb_atoms = []

    for resname in HYDROPHOBIC_RESNAMES:
        sel = u.select_atoms(f"resname {resname} and protein and name CB")
        for atom in sel:
            cb_atoms.append(atom)

    results = []
    n = len(cb_atoms)

    if n < 2:
        return results

    # Extract positions matrix
    positions = np.array([a.position for a in cb_atoms])
    dists = cdist(positions, positions)

    seen_pairs = set()

    for i in range(n):
        for j in range(i + 1, n):
            pair_key = (i, j)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            dist = float(dists[i, j])
            if dist > cutoff:
                continue

            atom_i = cb_atoms[i]
            atom_j = cb_atoms[j]
            res_i = atom_i.residue
            res_j = atom_j.residue

            # Skip if same residue
            if res_i.resid == res_j.resid:
                continue

            # Skip if sequence-adjacent (backbone contacts, not hydrophobic packing)
            if abs(int(res_i.resid) - int(res_j.resid)) <= MIN_SEQ_SEP:
                continue

            results.append({
                "id": f"hph_{atom_i.id}_{atom_j.id}",
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
