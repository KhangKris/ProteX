import MDAnalysis as mda
import numpy as np
from typing import List, Dict, Any

# Aromatic ring atom names per residue
AROMATIC_RINGS: Dict[str, List[str]] = {
    "PHE": ["CG", "CD1", "CD2", "CE1", "CE2", "CZ"],
    "TYR": ["CG", "CD1", "CD2", "CE1", "CE2", "CZ"],
    "TRP": ["CD2", "CE2", "CE3", "CZ2", "CZ3", "CH2"],   # 6-membered pyrrole-side ring
    "HIS": ["CG", "ND1", "CD2", "CE1", "NE2"],
}

# Cutoffs
CENTROID_CUTOFF = 7.5     # Å between ring centroids (5.5 face-to-face, up to 7.5 for T-shaped)
PARALLEL_ANGLE_MAX = 35.0  # ° — face-to-face (parallel/antiparallel)
TSHAPE_ANGLE_MIN = 55.0    # ° — T-shaped / edge-to-face
TSHAPE_ANGLE_MAX = 90.0


def _ring_centroid_and_normal(atoms) -> tuple:
    """
    Given a set of ring atoms, return the centroid (mean position)
    and the unit normal vector (from cross-product of two edge vectors).
    """
    positions = atoms.positions
    centroid = positions.mean(axis=0)

    # Use first three atoms to define the ring plane
    v1 = positions[1] - positions[0]
    v2 = positions[2] - positions[0]
    normal = np.cross(v1, v2)
    norm_len = np.linalg.norm(normal)
    if norm_len < 1e-6:
        normal = np.array([0.0, 0.0, 1.0])
    else:
        normal /= norm_len

    return centroid, normal


def detect_pi_stacking(u: mda.Universe,
                        centroid_cutoff: float = CENTROID_CUTOFF) -> List[Dict[str, Any]]:
    """
    Detects π–π stacking interactions between aromatic residues.
    Also calculates the ring centroid offset (slippage) for dispersion modeling.
    """
    # Collect (residue, centroid, normal) for every aromatic ring
    ring_data = []

    for resname, ring_atoms_names in AROMATIC_RINGS.items():
        selection = f"resname {resname} and protein"
        residues = u.select_atoms(selection).residues

        for residue in residues:
            # Get the ring atoms that exist in this residue
            ring_sel = residue.atoms.select_atoms(
                "name " + " ".join(ring_atoms_names)
            )
            if len(ring_sel) < 3:
                continue

            centroid, normal = _ring_centroid_and_normal(ring_sel)
            ring_data.append({
                "residue": residue,
                "centroid": centroid,
                "normal": normal,
                "resname": resname,
            })

    results = []
    n = len(ring_data)

    for i in range(n):
        for j in range(i + 1, n):
            ri = ring_data[i]
            rj = ring_data[j]

            # Skip same residue
            if ri["residue"].resid == rj["residue"].resid:
                continue

            # Centroid distance
            vec = rj["centroid"] - ri["centroid"]
            dist = float(np.linalg.norm(vec))
            if dist > centroid_cutoff:
                continue

            # Angle between ring normals (in degrees)
            cos_angle = abs(np.dot(ri["normal"], rj["normal"]))
            cos_angle = min(1.0, cos_angle)  # numerical safety
            angle_deg = float(np.degrees(np.arccos(cos_angle)))

            # Centroid slippage (offset) calculation:
            # offset = sqrt(dist^2 - d_perp^2) where d_perp = |vec . normal_i|
            d_perp = abs(np.dot(vec, ri["normal"]))
            offset = 0.0
            if dist > d_perp:
                offset = float(np.sqrt(dist**2 - d_perp**2))

            # Classify stacking type
            if angle_deg <= PARALLEL_ANGLE_MAX:
                stack_type = "parallel"
            elif TSHAPE_ANGLE_MIN <= angle_deg <= TSHAPE_ANGLE_MAX:
                stack_type = "t-shaped"
            else:
                continue  # not a recognized stacking geometry

            res_i = ri["residue"]
            res_j = rj["residue"]

            results.append({
                "id": f"pi_{res_i.resid}_{res_j.resid}",
                "distance": round(dist, 3),
                "angle": round(angle_deg, 1),
                "offset": round(offset, 3),
                "stack_type": stack_type,
                # Centroid coordinates used for drawing the inter-ring connector
                "centroid_a": [float(x) for x in ri["centroid"]],
                "centroid_b": [float(x) for x in rj["centroid"]],
                "residue_a": {
                    "name": res_i.resname,
                    "number": int(res_i.resid),
                    "chain": str(res_i.segid) if hasattr(res_i, "segid") else "A",
                },
                "residue_b": {
                    "name": res_j.resname,
                    "number": int(res_j.resid),
                    "chain": str(res_j.segid) if hasattr(res_j, "segid") else "A",
                },
            })

    results.sort(key=lambda x: x["distance"])
    return results
