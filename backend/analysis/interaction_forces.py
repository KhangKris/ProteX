"""
Interaction Force / Energy Estimation (Advanced Biophysics Research Version)

Provides mathematically and physically rigorous calculations of molecular interaction energies
and force vectors between residues/atoms.

Includes:
  - Salt Bridges: Mehler-Solmajer distance-dependent dielectric constant model ε(r) & Coulomb force gradient.
  - Hydrogen Bonds: Baker-Hubbard angular correction and Lennard-Jones 10-12 potential & forces.
  - Disulfide Bonds: Harmonic stretching potential combined with disulfide dihedral torsion strain.
  - π-π Stacking: Centroid distance and ring slippage (offset) offset-dependent Lennard-Jones potential.
  - Hydrophobic Contacts: Empirical Lennard-Jones 6-12 potential for van der Waals attraction.

Force unit conversion: 1 kJ/(mol·Å) ≈ 16.6054 piconewtons (pN).
"""

import math
import numpy as np
from typing import Dict, Any, List, Optional

# Physical constants
COULOMB_K = 1389.354      # kJ·Å/(mol·e²) — Coulomb constant in biological units
KJ_MOL_A_TO_PN = 16.60539 # Conversion factor from kJ/(mol·Å) to piconewtons (pN)

# ── Dielectric Models ────────────────────────────────────────────────────────

def mehler_solmajer_dielectric(r: float) -> float:
    """
    Mehler-Solmajer distance-dependent dielectric constant model.
    ε(r) = A + B / (1 + exp(-λ * (r - r0)))
    Where:
      A = 1.0 (vacuum limit)
      B = 77.0 (water dielectric increment)
      λ = 0.357 (screening parameter)
      r0 = 5.5 Å (dielectric transition radius)
    """
    return 1.0 + 77.0 / (1.0 + math.exp(-0.357 * (r - 5.5)))

def mehler_solmajer_derivative(r: float) -> float:
    """
    First derivative of ε(r) with respect to r.
    Used for analytical force calculations.
    """
    exponent = -0.357 * (r - 5.5)
    denom = 1.0 + math.exp(exponent)
    return (77.0 * 0.357 * math.exp(exponent)) / (denom * denom)

# ── General Strength Classification ──────────────────────────────────────────

def classify_strength(energy_kj: float) -> str:
    """Classify interaction strength based on energy magnitude."""
    e = abs(energy_kj)
    if e >= 100:
        return "covalent"
    elif e >= 15:
        return "strong"
    elif e >= 5:
        return "moderate"
    else:
        return "weak"

def format_detailed_strength(strength: str, energy: float, force_pn: float) -> str:
    """Format detailed label showing strength, energy, and force."""
    return f"{strength.capitalize()} ({energy:.1f} kJ/mol, {force_pn:.1f} pN)"

# ── Vector Math Helper ────────────────────────────────────────────────────────

def compute_force_vector(
    coord_a: List[float],
    coord_b: List[float],
    force_magnitude_pn: float
) -> List[float]:
    """
    Compute force vector pointing from partner B to partner A.
    """
    p_a = np.array(coord_a)
    p_b = np.array(coord_b)
    direction = p_a - p_b
    dist = np.linalg.norm(direction)
    if dist < 1e-6:
        return [0.0, 0.0, 0.0]
    unit_vector = direction / dist
    return [float(x) for x in unit_vector * force_magnitude_pn]

# ── Specific Interaction Physics Models ──────────────────────────────────────

def calculate_salt_bridge(distance: float, q1: float = 1.0, q2: float = -1.0) -> tuple:
    """
    Coulomb interaction with Mehler-Solmajer dielectric.
    Returns (energy_kj_mol, force_magnitude_pn).
    """
    if distance <= 0.5:
        return 0.0, 0.0
    
    eps = mehler_solmajer_dielectric(distance)
    energy = COULOMB_K * q1 * q2 / (eps * distance)
    
    # Analytical force = -dE/dr
    # E(r) = k*q1*q2 / (ε(r) * r)
    # dE/dr = k*q1*q2 * [-1/(ε*r^2) - ε'/(ε^2 * r)]
    eps_prime = mehler_solmajer_derivative(distance)
    dE_dr = COULOMB_K * q1 * q2 * (-1.0 / (eps * distance**2) - eps_prime / (eps**2 * distance))
    
    force_mag_kj_mol_a = -dE_dr
    force_mag_pn = force_mag_kj_mol_a * KJ_MOL_A_TO_PN
    
    return energy, force_mag_pn

def calculate_hbond(distance: float, angle_deg: Optional[float] = None) -> tuple:
    """
    Baker-Hubbard angular correction and 10-12 Lennard-Jones potential.
    V(r) = ε_depth * (5 * (r0/r)^12 - 6 * (r0/r)^10)
    Returns (energy_kj_mol, force_magnitude_pn).
    """
    r0 = 2.8   # Optimal donor-acceptor distance in Å
    eps_depth = 20.0  # Well depth in kJ/mol (positive to make minimum at -20.0)
    
    if distance <= 0.5:
        return 0.0, 0.0
    
    ratio = r0 / distance
    energy_dist = eps_depth * (5 * ratio**12 - 6 * ratio**10)
    
    # Force from distance: F = -dE/dr
    # dE/dr = eps_depth * (-60 * r0^12 / r^13 + 60 * r0^10 / r^11)
    dE_dr = eps_depth * (-60.0 * (r0**12) / (distance**13) + 60.0 * (r0**10) / (distance**11))
    force_mag_dist = -dE_dr
    
    # Angular correction factor: cos^2(theta)
    angle_factor = 1.0
    if angle_deg is not None:
        theta_rad = math.radians(angle_deg)
        angle_factor = math.cos(theta_rad) ** 2
        
    energy = energy_dist * angle_factor
    force_mag_pn = force_mag_dist * angle_factor * KJ_MOL_A_TO_PN
    
    return energy, force_mag_pn

def calculate_disulfide(distance: float, dihedral_deg: Optional[float] = None) -> tuple:
    """
    Harmonic stretch potential combined with disulfide dihedral torsion strain.
    E(r, x3) = E_ideal + Kr * (r - r0)^2 + V2 * (1 - cos(2*x3))
    """
    r0 = 2.05   # Ideal S-S distance in Å
    Kr = 836.0  # Covalent stretch spring constant in kJ/(mol·Å²)
    E_ideal = -251.0  # Ideal disulfide bond energy in kJ/mol
    V2 = 15.0   # Torsion barrier height in kJ/mol
    
    # Stretch energy
    e_stretch = Kr * (distance - r0) ** 2
    
    # Torsion strain energy
    e_torsion = 0.0
    if dihedral_deg is not None:
        x3_rad = math.radians(dihedral_deg)
        e_torsion = V2 * (1.0 - math.cos(2.0 * x3_rad))
        
    energy = E_ideal + e_stretch + e_torsion
    
    # Force = -dE/dr = -2 * Kr * (r - r0)
    dE_dr = 2.0 * Kr * (distance - r0)
    force_mag_pn = -dE_dr * KJ_MOL_A_TO_PN
    
    return energy, force_mag_pn

def calculate_pi_stacking(
    distance: float,
    angle_deg: float,
    offset: Optional[float] = None,
    stack_type: str = "parallel"
) -> tuple:
    """
    Lennard-Jones potential with angular and offset slippage dependencies.
    """
    # Parallel vs T-shaped presets (positive well depth)
    if stack_type == "parallel":
        r0 = 3.8
        eps_depth = 10.0
    else:
        r0 = 5.0
        eps_depth = 6.0
        
    if distance <= 0.5:
        return 0.0, 0.0
        
    # Apply offset penalty if available
    offset_factor = 1.0
    if offset is not None and offset > 0:
        # Penalty increases as ring centroids slip apart
        offset_factor = math.exp(-0.5 * (offset / 1.5) ** 2)
        
    ratio = r0 / distance
    # LJ 6-12 potential: E = eps_depth * ((r0/r)^12 - 2 * (r0/r)^6)
    energy_dist = eps_depth * (ratio**12 - 2.0 * ratio**6)
    
    # Force F = -dE/dr
    # dE/dr = eps_depth * (-12 * r0^12 / r^13 + 12 * r0^6 / r^7)
    dE_dr = eps_depth * (-12.0 * (r0**12) / (distance**13) + 12.0 * (r0**6) / (distance**7))
    force_mag_dist = -dE_dr
    
    energy = energy_dist * offset_factor
    force_mag_pn = force_mag_dist * offset_factor * KJ_MOL_A_TO_PN
    
    return energy, force_mag_pn

def calculate_hydrophobic(distance: float) -> tuple:
    """
    Standard Lennard-Jones 6-12 potential for hydrophobic dispersion contacts.
    """
    r0 = 4.0   # Optimal Cβ-Cβ distance in Å
    eps_depth = 5.0   # Well depth in kJ/mol
    
    if distance <= 0.5:
        return 0.0, 0.0
        
    ratio = r0 / distance
    energy = eps_depth * (ratio**12 - 2.0 * ratio**6)
    
    # F = -dE/dr
    dE_dr = eps_depth * (-12.0 * (r0**12) / (distance**13) + 12.0 * (r0**6) / (distance**7))
    force_mag_pn = -dE_dr * KJ_MOL_A_TO_PN
    
    return energy, force_mag_pn

# ── Public APIs ───────────────────────────────────────────────────────────────

def estimate_salt_bridge_energy(
    distance: float,
    coord_a: Optional[List[float]] = None,
    coord_b: Optional[List[float]] = None
) -> Dict[str, Any]:
    energy, force_mag = calculate_salt_bridge(distance)
    strength = classify_strength(energy)
    
    res: Dict[str, Any] = {
        "energy_kj_mol": round(energy, 2),
        "force_pn": round(abs(force_mag), 2),
        "strength": strength,
        "detailed_strength": format_detailed_strength(strength, energy, abs(force_mag)),
        "force_type": "electrostatic",
        "force_vector": [0.0, 0.0, 0.0]
    }
    
    if coord_a and coord_b:
        res["force_vector"] = compute_force_vector(coord_a, coord_b, force_mag)
        
    return res

def estimate_hbond_energy(
    distance: float,
    angle_deg: Optional[float] = None,
    coord_a: Optional[List[float]] = None,
    coord_b: Optional[List[float]] = None
) -> Dict[str, Any]:
    energy, force_mag = calculate_hbond(distance, angle_deg)
    strength = classify_strength(energy)
    
    res: Dict[str, Any] = {
        "energy_kj_mol": round(energy, 2),
        "force_pn": round(abs(force_mag), 2),
        "strength": strength,
        "detailed_strength": format_detailed_strength(strength, energy, abs(force_mag)),
        "force_type": "hydrogen",
        "force_vector": [0.0, 0.0, 0.0]
    }
    
    if coord_a and coord_b:
        res["force_vector"] = compute_force_vector(coord_a, coord_b, force_mag)
        
    return res

def estimate_disulfide_energy(
    distance: float,
    dihedral_deg: Optional[float] = None,
    coord_a: Optional[List[float]] = None,
    coord_b: Optional[List[float]] = None
) -> Dict[str, Any]:
    energy, force_mag = calculate_disulfide(distance, dihedral_deg)
    
    res: Dict[str, Any] = {
        "energy_kj_mol": round(energy, 2),
        "force_pn": round(abs(force_mag), 2),
        "strength": "covalent",
        "detailed_strength": format_detailed_strength("covalent", energy, abs(force_mag)),
        "force_type": "covalent",
        "force_vector": [0.0, 0.0, 0.0]
    }
    
    if coord_a and coord_b:
        res["force_vector"] = compute_force_vector(coord_a, coord_b, force_mag)
        
    return res

def estimate_pi_energy(
    distance: float,
    angle_deg: float,
    offset: Optional[float] = None,
    stack_type: str = "parallel",
    coord_a: Optional[List[float]] = None,
    coord_b: Optional[List[float]] = None
) -> Dict[str, Any]:
    energy, force_mag = calculate_pi_stacking(distance, angle_deg, offset, stack_type)
    strength = classify_strength(energy)
    
    res: Dict[str, Any] = {
        "energy_kj_mol": round(energy, 2),
        "force_pn": round(abs(force_mag), 2),
        "strength": strength,
        "detailed_strength": format_detailed_strength(strength, energy, abs(force_mag)),
        "force_type": "dispersion",
        "force_vector": [0.0, 0.0, 0.0]
    }
    
    if coord_a and coord_b:
        res["force_vector"] = compute_force_vector(coord_a, coord_b, force_mag)
        
    return res

def estimate_hydrophobic_energy(
    distance: float,
    coord_a: Optional[List[float]] = None,
    coord_b: Optional[List[float]] = None
) -> Dict[str, Any]:
    energy, force_mag = calculate_hydrophobic(distance)
    strength = classify_strength(energy)
    
    res: Dict[str, Any] = {
        "energy_kj_mol": round(energy, 2),
        "force_pn": round(abs(force_mag), 2),
        "strength": strength,
        "detailed_strength": format_detailed_strength(strength, energy, abs(force_mag)),
        "force_type": "van_der_waals",
        "force_vector": [0.0, 0.0, 0.0]
    }
    
    if coord_a and coord_b:
        res["force_vector"] = compute_force_vector(coord_a, coord_b, force_mag)
        
    return res

# ── In-place Enricher ─────────────────────────────────────────────────────────

def enrich_interactions(
    salt_bridges: List[Dict],
    hydrogen_bonds: List[Dict],
    disulfide_bonds: List[Dict],
    pi_stacking: List[Dict],
    hydrophobic_contacts: List[Dict],
) -> None:
    """
    Enriches all interaction dictionaries with physics-based energies, forces,
    and detailed strength labels.
    """
    for sb in salt_bridges:
        coord_a = sb.get("positive_atom", {}).get("coordinates")
        coord_b = sb.get("negative_atom", {}).get("coordinates")
        e = estimate_salt_bridge_energy(sb["distance"], coord_a, coord_b)
        sb.update(e)
        
    for hb in hydrogen_bonds:
        angle = hb.get("angle")
        coord_a = hb.get("donor_atom", {}).get("coordinates")
        coord_b = hb.get("acceptor_atom", {}).get("coordinates")
        e = estimate_hbond_energy(hb["distance"], angle, coord_a, coord_b)
        hb.update(e)
        
    for ss in disulfide_bonds:
        dihedral = ss.get("dihedral_angle")
        coord_a = ss.get("atom_a", {}).get("coordinates")
        coord_b = ss.get("atom_b", {}).get("coordinates")
        e = estimate_disulfide_energy(ss["distance"], dihedral, coord_a, coord_b)
        ss.update(e)
        
    for pi in pi_stacking:
        angle = pi.get("angle", 0.0)
        offset = pi.get("offset")
        stype = pi.get("stack_type", "parallel")
        coord_a = pi.get("centroid_a")
        coord_b = pi.get("centroid_b")
        e = estimate_pi_energy(pi["distance"], angle, offset, stype, coord_a, coord_b)
        pi.update(e)
        
    for hc in hydrophobic_contacts:
        coord_a = hc.get("atom_a", {}).get("coordinates")
        coord_b = hc.get("atom_b", {}).get("coordinates")
        e = estimate_hydrophobic_energy(hc["distance"], coord_a, coord_b)
        hc.update(e)
