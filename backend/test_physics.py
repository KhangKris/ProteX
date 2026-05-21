import sys
import os

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analysis.interaction_forces import (
    estimate_salt_bridge_energy,
    estimate_hbond_energy,
    estimate_disulfide_energy,
    estimate_pi_energy,
    estimate_hydrophobic_energy
)

def test_physics():
    print("Testing physics calculations...")
    
    # 1. Salt Bridge (Mehler-Solmajer dielectric)
    sb_near = estimate_salt_bridge_energy(3.0, [0,0,0], [3,0,0])
    sb_far = estimate_salt_bridge_energy(6.0, [0,0,0], [6,0,0])
    print(f"Salt Bridge (3.0 Å): {sb_near['detailed_strength']} | Force Vec: {sb_near['force_vector']}")
    print(f"Salt Bridge (6.0 Å): {sb_far['detailed_strength']} | Force Vec: {sb_far['force_vector']}")
    
    # 2. Hydrogen Bond (Baker-Hubbard angle)
    hb_ideal = estimate_hbond_energy(2.8, 180.0, [0,0,0], [2.8,0,0])
    hb_bent = estimate_hbond_energy(2.8, 130.0, [0,0,0], [2.8,0,0])
    print(f"H-Bond (Ideal angle 180°): {hb_ideal['detailed_strength']} | Force Vec: {hb_ideal['force_vector']}")
    print(f"H-Bond (Bent angle 130°): {hb_bent['detailed_strength']} | Force Vec: {hb_bent['force_vector']}")
    
    # 3. Disulfide Bond (Harmonic + Torsion angle)
    ss_ideal = estimate_disulfide_energy(2.05, 90.0, [0,0,0], [2.05,0,0])
    ss_strained = estimate_disulfide_energy(2.4, 0.0, [0,0,0], [2.4,0,0])
    print(f"Disulfide (Ideal): {ss_ideal['detailed_strength']} | Force Vec: {ss_ideal['force_vector']}")
    print(f"Disulfide (Strained): {ss_strained['detailed_strength']} | Force Vec: {ss_strained['force_vector']}")

    # 4. Pi Stacking (Offset factor)
    pi_ideal = estimate_pi_energy(3.8, 0.0, 0.0, "parallel", [0,0,0], [3.8,0,0])
    pi_slipped = estimate_pi_energy(3.8, 0.0, 2.0, "parallel", [0,0,0], [3.8,0,0])
    print(f"Pi Stacking (Ideal): {pi_ideal['detailed_strength']} | Force Vec: {pi_ideal['force_vector']}")
    print(f"Pi Stacking (Slipped 2Å): {pi_slipped['detailed_strength']} | Force Vec: {pi_slipped['force_vector']}")
    
    # 5. Hydrophobic Contact
    hc = estimate_hydrophobic_energy(4.0, [0,0,0], [4.0,0,0])
    print(f"Hydrophobic: {hc['detailed_strength']} | Force Vec: {hc['force_vector']}")

if __name__ == "__main__":
    test_physics()
