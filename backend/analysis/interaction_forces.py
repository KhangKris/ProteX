"""
Interaction Force / Energy Estimation

Calculates approximate interaction energies (kJ/mol) for each detected
molecular interaction. This is information that OpenFold 3 does NOT provide.

Methods:
  - Salt Bridges:   Coulomb electrostatic (q₁q₂ / 4πε₀εr)
  - Hydrogen Bonds: Distance-dependent empirical potential
  - Disulfide:      Fixed covalent bond energy
  - π-π Stacking:   Distance-dependent dispersion
  - Hydrophobic:    Effective van der Waals potential
"""

import math
from typing import Dict, Any, List

# Physical constants
COULOMB_K = 1389.354  # kJ·Å/(mol·e²) — Coulomb constant in appropriate units
DIELECTRIC = 4.0       # Effective dielectric for protein interior
ELEMENTARY_CHARGE = 1.0  # Unit charge

# ── Empirical energy ranges (kJ/mol) ────────────────────────────────────────

ENERGY_PARAMS = {
    "salt_bridge": {
        "charge_product": -1.0,  # +1 × -1
        "typical_range": (-17.0, -12.0),
    },
    "hydrogen_bond": {
        "optimal_distance": 2.8,  # Å
        "well_depth": -20.0,      # kJ/mol at optimal distance
        "typical_range": (-30.0, -4.0),
    },
    "disulfide_bond": {
        "energy": -251.0,  # kJ/mol — covalent S-S bond
        "typical_range": (-260.0, -240.0),
    },
    "pi_stacking": {
        "parallel_range": (-12.0, -4.0),
        "tshaped_range": (-8.0, -2.0),
    },
    "hydrophobic": {
        "well_depth": -5.0,   # kJ/mol
        "optimal_distance": 4.0,  # Å
        "typical_range": (-8.0, -1.0),
    },
}


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


def coulomb_energy(distance: float, q1: float = 1.0, q2: float = -1.0,
                   dielectric: float = DIELECTRIC) -> float:
    """
    Coulomb electrostatic energy: E = k * q1 * q2 / (ε * r)
    Returns energy in kJ/mol.
    """
    if distance <= 0:
        return 0.0
    return COULOMB_K * q1 * q2 / (dielectric * distance)


def hbond_energy(distance: float) -> float:
    """
    Empirical hydrogen bond energy.
    Uses a Lennard-Jones-like 10-12 potential centered at 2.8 Å.
    """
    r0 = ENERGY_PARAMS["hydrogen_bond"]["optimal_distance"]
    depth = ENERGY_PARAMS["hydrogen_bond"]["well_depth"]
    if distance <= 0:
        return 0.0
    ratio = r0 / distance
    # Simplified 10-12 potential
    energy = depth * (5 * ratio**12 - 6 * ratio**10)
    return max(min(energy, 0.0), -30.0)  # Clamp to physical range


def pi_stacking_energy(distance: float, stack_type: str = "parallel") -> float:
    """
    Empirical π-π stacking energy.
    Distance-dependent with different profiles for parallel vs T-shaped.
    """
    if stack_type == "parallel":
        r0, depth = 3.8, -10.0
    else:
        r0, depth = 5.0, -6.0

    if distance <= 0:
        return 0.0
    ratio = r0 / distance
    energy = depth * ratio**6
    return max(energy, -12.0)


def hydrophobic_energy(distance: float) -> float:
    """
    Effective hydrophobic contact energy using simple inverse-distance model.
    """
    r0 = ENERGY_PARAMS["hydrophobic"]["optimal_distance"]
    depth = ENERGY_PARAMS["hydrophobic"]["well_depth"]
    if distance <= 0:
        return 0.0
    ratio = r0 / distance
    energy = depth * ratio**4
    return max(energy, -8.0)


# ── Public API ───────────────────────────────────────────────────────────────

def estimate_salt_bridge_energy(distance: float) -> Dict[str, Any]:
    """Estimate energy for a salt bridge interaction."""
    energy = coulomb_energy(distance)
    return {
        "energy_kj_mol": round(energy, 2),
        "strength": classify_strength(energy),
        "force_type": "electrostatic",
    }


def estimate_hbond_energy(distance: float) -> Dict[str, Any]:
    """Estimate energy for a hydrogen bond."""
    energy = hbond_energy(distance)
    return {
        "energy_kj_mol": round(energy, 2),
        "strength": classify_strength(energy),
        "force_type": "hydrogen",
    }


def estimate_disulfide_energy(distance: float) -> Dict[str, Any]:
    """Estimate energy for a disulfide bond (covalent)."""
    energy = ENERGY_PARAMS["disulfide_bond"]["energy"]
    return {
        "energy_kj_mol": round(energy, 2),
        "strength": "covalent",
        "force_type": "covalent",
    }


def estimate_pi_energy(distance: float, stack_type: str = "parallel") -> Dict[str, Any]:
    """Estimate energy for a π-π stacking interaction."""
    energy = pi_stacking_energy(distance, stack_type)
    return {
        "energy_kj_mol": round(energy, 2),
        "strength": classify_strength(energy),
        "force_type": "dispersion",
    }


def estimate_hydrophobic_energy(distance: float) -> Dict[str, Any]:
    """Estimate energy for a hydrophobic contact."""
    energy = hydrophobic_energy(distance)
    return {
        "energy_kj_mol": round(energy, 2),
        "strength": classify_strength(energy),
        "force_type": "van_der_waals",
    }


def enrich_interactions(
    salt_bridges: List[Dict],
    hydrogen_bonds: List[Dict],
    disulfide_bonds: List[Dict],
    pi_stacking: List[Dict],
    hydrophobic_contacts: List[Dict],
) -> None:
    """
    In-place enrichment: adds energy_kj_mol, strength, force_type
    to each interaction dict in all five lists.
    """
    for sb in salt_bridges:
        e = estimate_salt_bridge_energy(sb["distance"])
        sb.update(e)

    for hb in hydrogen_bonds:
        e = estimate_hbond_energy(hb["distance"])
        hb.update(e)

    for ss in disulfide_bonds:
        e = estimate_disulfide_energy(ss["distance"])
        ss.update(e)

    for pi in pi_stacking:
        stype = pi.get("stack_type", "parallel")
        e = estimate_pi_energy(pi["distance"], stype)
        pi.update(e)

    for hc in hydrophobic_contacts:
        e = estimate_hydrophobic_energy(hc["distance"])
        hc.update(e)
