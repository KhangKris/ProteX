import MDAnalysis as mda
from MDAnalysis.analysis.hydrogenbonds.hbond_analysis import HydrogenBondAnalysis
import numpy as np
from scipy.spatial.distance import cdist
from typing import List, Dict, Any

def detect_hydrogen_bonds(u: mda.Universe, d_a_cutoff: float = 3.5, d_h_a_angle_cutoff: float = 120.0) -> Dict[str, Any]:
    """
    Detects hydrogen bonds in a protein structure.
    If hydrogen atoms are present, uses MDAnalysis HydrogenBondAnalysis.
    If no hydrogens are found, uses a Donor-Acceptor distance fallback (< 3.5 A).
    
    Parameters:
    - u: MDAnalysis Universe object
    - d_a_cutoff: Donor-Acceptor distance cutoff in Angstroms (default: 3.5)
    - d_h_a_angle_cutoff: D-H-A angle cutoff in degrees (default: 120.0)
    
    Returns:
    - Dict with list of bonds and metadata.
    """
    # Check if hydrogens are present in the structure
    hydrogens = u.select_atoms("element H or name H*")
    
    if len(hydrogens) > 0:
        return _detect_with_hbond_analysis(u, d_a_cutoff, d_h_a_angle_cutoff)
    else:
        return _detect_with_fallback(u, d_a_cutoff)

def _detect_with_hbond_analysis(u: mda.Universe, d_a_cutoff: float, d_h_a_angle_cutoff: float) -> Dict[str, Any]:
    """
    Detects hydrogen bonds using MDAnalysis HydrogenBondAnalysis.
    """
    try:
        # Build donor, acceptor, and hydrogen selections
        # MDAnalysis default selections might fail if names are non-standard,
        # so we specify generic protein selections.
        donors_sel = "protein and (name N* or name O* or name S*)"
        acceptors_sel = "protein and (name N* or name O* or name S*)"
        hydrogens_sel = "protein and (name H* or element H)"
        
        hb = HydrogenBondAnalysis(
            u,
            donors_sel=donors_sel,
            acceptors_sel=acceptors_sel,
            hydrogens_sel=hydrogens_sel,
            d_a_cutoff=d_a_cutoff,
            d_h_a_angle_cutoff=d_h_a_angle_cutoff
        )
        
        hb.run()
        
        hbonds_list = []
        
        # Results are in hb.results.hbonds
        # Format: [frame, donor_index, hydrogen_index, acceptor_index, distance, angle]
        if hasattr(hb.results, 'hbonds') and len(hb.results.hbonds) > 0:
            for row in hb.results.hbonds:
                # MDAnalysis returns atom indices which can be resolved via u.atoms[index]
                d_idx = int(row[1])
                h_idx = int(row[2])
                a_idx = int(row[3])
                dist = float(row[4])
                angle = float(row[5])
                
                donor = u.atoms[d_idx]
                hydrogen = u.atoms[h_idx]
                acceptor = u.atoms[a_idx]
                
                bond_id = f"hb_{donor.id}_{acceptor.id}"
                
                # Format coordinates
                d_coord = [float(x) for x in donor.position]
                h_coord = [float(x) for x in hydrogen.position]
                a_coord = [float(x) for x in acceptor.position]
                
                hbonds_list.append({
                    "id": bond_id,
                    "distance": round(dist, 3),
                    "angle": round(angle, 1),
                    "fallback": False,
                    
                    "donor_residue": {
                        "name": donor.residue.resname,
                        "number": int(donor.residue.resid),
                        "chain": str(donor.residue.segid) if hasattr(donor.residue, 'segid') else "A"
                    },
                    "donor_atom": {
                        "id": int(donor.id),
                        "name": str(donor.name),
                        "coordinates": d_coord
                    },
                    
                    "hydrogen_atom": {
                        "id": int(hydrogen.id),
                        "name": str(hydrogen.name),
                        "coordinates": h_coord
                    },
                    
                    "acceptor_residue": {
                        "name": acceptor.residue.resname,
                        "number": int(acceptor.residue.resid),
                        "chain": str(acceptor.residue.segid) if hasattr(acceptor.residue, 'segid') else "A"
                    },
                    "acceptor_atom": {
                        "id": int(acceptor.id),
                        "name": str(acceptor.name),
                        "coordinates": a_coord
                    }
                })
        
        hbonds_list.sort(key=lambda x: x["distance"])
        return {
            "hydrogen_bonds": hbonds_list,
            "method": "MDAnalysis.HydrogenBondAnalysis",
            "count": len(hbonds_list)
        }
        
    except Exception as e:
        # If the analysis fails for any reason (e.g. selection error), run fallback
        return _detect_with_fallback(u, d_a_cutoff, warning=f"MDAnalysis H-Bond failed: {str(e)}")

def _detect_with_fallback(u: mda.Universe, d_a_cutoff: float, warning: str = None) -> Dict[str, Any]:
    """
    Fallback method when no hydrogen atoms are in the file.
    Identifies N/O/S donor-acceptor pairs within the cutoff.
    """
    # Select candidate atoms (N, O, S in protein)
    candidates_query = "protein and (name N* or name O* or name S*)"
    atoms = u.select_atoms(candidates_query)
    
    hbonds_list = []
    
    if len(atoms) < 2:
        return {
            "hydrogen_bonds": [],
            "method": "Fallback (Distance-only)",
            "warning": warning or "No hydrogen atoms found in file. Used fallback distance criteria.",
            "count": 0
        }
        
    # Vectorized pairwise distance calculation
    positions = atoms.positions
    dists = cdist(positions, positions)
    
    # We only care about donor-acceptor pairs (upper triangle of the distance matrix)
    # distance must be > 0.1 (not the same atom) and < cutoff
    indices = np.where((dists > 0.1) & (dists < d_a_cutoff))
    
    seen_pairs = set()
    
    for i, j in zip(indices[0], indices[1]):
        # Keep unique pairs
        pair_key = tuple(sorted([i, j]))
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)
        
        atom_i = atoms[i]
        atom_j = atoms[j]
        
        # Exclude atoms in the same residue
        if atom_i.residue.resid == atom_j.residue.resid:
            continue
            
        dist = float(dists[i, j])
        
        # Define donor and acceptor based on standard chemical naming conventions
        # For simple visual rendering, we just pair atom_i and atom_j
        d_coord = [float(x) for x in atom_i.position]
        a_coord = [float(x) for x in atom_j.position]
        
        hbonds_list.append({
            "id": f"hb_fallback_{atom_i.id}_{atom_j.id}",
            "distance": round(dist, 3),
            "angle": None,  # No hydrogens, so no angle calculation
            "fallback": True,
            
            "donor_residue": {
                "name": atom_i.residue.resname,
                "number": int(atom_i.residue.resid),
                "chain": str(atom_i.residue.segid) if hasattr(atom_i.residue, 'segid') else "A"
            },
            "donor_atom": {
                "id": int(atom_i.id),
                "name": str(atom_i.name),
                "coordinates": d_coord
            },
            
            "hydrogen_atom": None,  # Missing
            
            "acceptor_residue": {
                "name": atom_j.residue.resname,
                "number": int(atom_j.residue.resid),
                "chain": str(atom_j.residue.segid) if hasattr(atom_j.residue, 'segid') else "A"
            },
            "acceptor_atom": {
                "id": int(atom_j.id),
                "name": str(atom_j.name),
                "coordinates": a_coord
            }
        })
        
    hbonds_list.sort(key=lambda x: x["distance"])
    return {
        "hydrogen_bonds": hbonds_list,
        "method": "Fallback (Distance-only)",
        "warning": warning or "No hydrogen atoms found in file. Fallback donor-acceptor mode used.",
        "count": len(hbonds_list)
    }
