import MDAnalysis as mda
import numpy as np
from scipy.spatial.distance import cdist
from typing import List, Dict, Any

# Disulfide bond S-S distance is ~2.05 Å; allow up to 2.5 Å for structural noise
DISULFIDE_CUTOFF = 2.5

def _calculate_dihedral(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray, p4: np.ndarray) -> float:
    """
    Calculate the dihedral angle (torsion angle) in degrees between four points.
    """
    b1 = p2 - p1
    b2 = p3 - p2
    b3 = p4 - p3

    # Normals of the planes
    n1 = np.cross(b1, b2)
    n1_norm = np.linalg.norm(n1)
    if n1_norm < 1e-6:
        return 90.0
    n1 /= n1_norm

    n2 = np.cross(b2, b3)
    n2_norm = np.linalg.norm(n2)
    if n2_norm < 1e-6:
        return 90.0
    n2 /= n2_norm

    # Orthogonal vector
    b2_norm = np.linalg.norm(b2)
    if b2_norm < 1e-6:
        return 90.0
    m1 = np.cross(n1, b2 / b2_norm)

    x = np.dot(n1, n2)
    y = np.dot(m1, n2)

    return float(np.degrees(np.arctan2(y, x)))

def detect_disulfide_bonds(u: mda.Universe, cutoff: float = DISULFIDE_CUTOFF) -> List[Dict[str, Any]]:
    """
    Detects disulfide bonds (CYS–CYS covalent S–S linkages) in a protein structure.
    Also calculates the Cβ-Sγ-Sγ-Cβ dihedral torsion angle for strain energy calculations.
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

                # Attempt to retrieve CB atoms for dihedral calculation
                cb_i = res_i.atoms.select_atoms("name CB")
                cb_j = res_j.atoms.select_atoms("name CB")

                dihedral = 90.0 # Default optimal value if CB is missing
                if len(cb_i) > 0 and len(cb_j) > 0:
                    try:
                        dihedral = _calculate_dihedral(
                            cb_i[0].position,
                            atom_i.position,
                            atom_j.position,
                            cb_j[0].position
                        )
                    except Exception:
                        pass

                results.append({
                    "id": f"ss_{atom_i.id}_{atom_j.id}",
                    "distance": round(dist, 3),
                    "dihedral_angle": round(dihedral, 1),
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
