import { SaltBridge, HydrogenBond, DisulfideBond, PiStack, HydrophobicContact } from './api';

// Physical constants
const COULOMB_K = 1389.354; // kJ·Å/(mol·e²)
const R_GAS = 8.314e-3;     // kJ/(mol·K)

// Reference model pKa values for titratable residues
export const MODEL_PKA: Record<string, number> = {
  ASP: 3.9,
  GLU: 4.3,
  HIS: 6.0,
  LYS: 10.5,
  ARG: 12.5,
};

// Mehler-Solmajer dielectric constant model
export function mehlerSolmajerDielectric(r: number): number {
  if (r <= 0) return 1.0;
  return 1.0 + 77.0 / (1.0 + Math.exp(-0.357 * (r - 5.5)));
}

/**
 * Predicts local shifted pKa values and charges for titratable residues at a given pH and temperature.
 */
export function calculateProtonationStates(
  saltBridges: SaltBridge[],
  pH: number,
  tempK: number
): Record<string, { pKa: number; charge: number }> {
  const RT = R_GAS * tempK;
  
  // 1. Identify all titratable residues involved in salt bridges
  const states: Record<string, { resname: string; originalPka: number; deltaPka: number; charge: number }> = {};

  const registerResidue = (chain: string, num: number, name: string) => {
    const key = `${chain}_${num}`;
    if (!states[key] && MODEL_PKA[name] !== undefined) {
      states[key] = {
        resname: name,
        originalPka: MODEL_PKA[name],
        deltaPka: 0,
        charge: 0,
      };
    }
  };

  for (const sb of saltBridges) {
    registerResidue(sb.positive_residue.chain, sb.positive_residue.number, sb.positive_residue.name);
    registerResidue(sb.negative_residue.chain, sb.negative_residue.number, sb.negative_residue.name);
  }

  // 2. Compute local pKa shifts due to electrostatic pairing (Coulomb perturbation)
  // Basic residues (LYS, ARG, HIS) near negative charges have pKa shifted UP (stabilizing protonated state).
  // Acidic residues (ASP, GLU) near positive charges have pKa shifted DOWN (stabilizing deprotonated state).
  for (const sb of saltBridges) {
    const keyPos = `${sb.positive_residue.chain}_${sb.positive_residue.number}`;
    const keyNeg = `${sb.negative_residue.chain}_${sb.negative_residue.number}`;
    
    const r = sb.distance;
    if (r <= 0.5) continue;
    const eps = mehlerSolmajerDielectric(r);

    // Compute standard Coulomb shift component: delta = +/- (k * q_partner) / (2.303 * R * T * eps * r)
    const factor = COULOMB_K / (2.303 * RT * eps * r);

    // Basic residue (perturbed by negative charge)
    if (states[keyPos]) {
      states[keyPos].deltaPka += factor * 0.5; // Scale down slightly to account for solvent screening
    }
    // Acidic residue (perturbed by positive charge)
    if (states[keyNeg]) {
      states[keyNeg].deltaPka -= factor * 0.5;
    }
  }

  // 3. Compute final shifted charges using Henderson-Hasselbalch equations
  const result: Record<string, { pKa: number; charge: number }> = {};
  
  for (const [key, state] of Object.entries(states)) {
    // Clamp deltaPka to a physically realistic range (+/- 3.0 units max)
    const clampedDelta = Math.max(-3.0, Math.min(3.0, state.deltaPka));
    const shiftedPka = state.originalPka + clampedDelta;
    
    let charge = 0;
    if (state.resname === 'ASP' || state.resname === 'GLU') {
      // Acidic residues: deprotonated (-) at high pH, neutral (0) at low pH
      charge = -1.0 / (1.0 + Math.pow(10, shiftedPka - pH));
    } else {
      // Basic residues: protonated (+) at low pH, neutral (0) at high pH
      charge = +1.0 / (1.0 + Math.pow(10, pH - shiftedPka));
    }

    result[key] = {
      pKa: shiftedPka,
      charge: charge,
    };
  }

  return result;
}

export interface RecalculatedState {
  saltBridges: (SaltBridge & { snapped: boolean; force_pn: number })[];
  hydrogenBonds: (HydrogenBond & { snapped: boolean })[];
  disulfideBonds: DisulfideBond[];
  piStacking: PiStack[];
  hydrophobicContacts: HydrophobicContact[];
  resFluc: Record<string, number>; // Dynamic RMSF per residue
}

/**
 * Performs real-time physics recalculations of molecular forces based on environmental sliders.
 */
export function recalculateEnvironmentalForces(
  data: {
    salt_bridges: SaltBridge[];
    hydrogen_bonds: HydrogenBond[];
    disulfide_bonds: DisulfideBond[];
    pi_stacking: PiStack[];
    hydrophobic_contacts: HydrophobicContact[];
  },
  pH: number,
  tempK: number
): RecalculatedState {
  const pKaStates = calculateProtonationStates(data.salt_bridges, pH, tempK);
  
  // 1. Recalculate Salt Bridges
  const saltBridges = data.salt_bridges.map(sb => {
    const keyPos = `${sb.positive_residue.chain}_${sb.positive_residue.number}`;
    const keyNeg = `${sb.negative_residue.chain}_${sb.negative_residue.number}`;
    
    // Retrieve dynamic charges or fallback to ideal +/- 1.0 charges
    const q1 = pKaStates[keyPos] ? pKaStates[keyPos].charge : 1.0;
    const q2 = pKaStates[keyNeg] ? pKaStates[keyNeg].charge : -1.0;

    const r = sb.distance;
    const eps = mehlerSolmajerDielectric(r);
    
    // E = k * q1 * q2 / (eps * r)
    const energy = (COULOMB_K * q1 * q2) / (eps * r);

    // Compute electrostatic force magnitude in pN
    // eps' = 77 * 0.357 * e^(-0.357(r-5.5)) / (1 + e^(-0.357(r-5.5)))^2
    const expTerm = Math.exp(-0.357 * (r - 5.5));
    const denom = 1.0 + expTerm;
    const epsPrime = (77.0 * 0.357 * expTerm) / (denom * denom);
    const dE_dr = COULOMB_K * q1 * q2 * (-1.0 / (eps * r * r) - epsPrime / (eps * eps * r));
    const forcePn = Math.abs(-dE_dr * 16.60539);

    // A salt bridge is snapped if its electrostatic stabilization weakens above -2.0 kJ/mol
    const snapped = energy > -2.0;

    return {
      ...sb,
      energy_kj_mol: Number(energy.toFixed(2)),
      force_pn: Number(forcePn.toFixed(1)),
      snapped,
    };
  });

  // 2. Recalculate Hydrogen Bonds (weakened slightly at extreme pH due to functional group protonation changes)
  const hydrogenBonds = data.hydrogen_bonds.map(hb => {
    let pHFactor = 1.0;
    
    // Extreme pH deprotonates amine donors or protonates carboxyl acceptors, reducing bonding ability
    if (pH < 2.0) {
      if (hb.acceptor_residue.name === 'ASP' || hb.acceptor_residue.name === 'GLU') pHFactor = 0.3;
    } else if (pH > 12.0) {
      if (hb.donor_residue.name === 'LYS' || hb.donor_residue.name === 'ARG') pHFactor = 0.3;
    }
    
    const energy = (hb.energy_kj_mol || 0) * pHFactor;
    const snapped = energy > -1.5;

    return {
      ...hb,
      energy_kj_mol: Number(energy.toFixed(2)),
      snapped,
    };
  });

  // 3. Compute Residue Stiffness for Elastic Fluctuation modeling
  const stiffnessMap: Record<string, number> = {};
  const addStiffness = (chain: string, num: number, k: number) => {
    const key = `${chain}_${num}`;
    stiffnessMap[key] = (stiffnessMap[key] || 0) + k;
  };

  const computeK = (energy: number, dist: number) => Math.max(0, Math.abs(energy) / (dist * dist));

  // Sum up stiffness contributions from all active interactions
  saltBridges.forEach(sb => {
    if (!sb.snapped) {
      const k = computeK(sb.energy_kj_mol || 0, sb.distance);
      addStiffness(sb.positive_residue.chain, sb.positive_residue.number, k);
      addStiffness(sb.negative_residue.chain, sb.negative_residue.number, k);
    }
  });

  hydrogenBonds.forEach(hb => {
    if (!hb.snapped) {
      const k = computeK(hb.energy_kj_mol || 0, hb.distance);
      addStiffness(hb.donor_residue.chain, hb.donor_residue.number, k);
      addStiffness(hb.acceptor_residue.chain, hb.acceptor_residue.number, k);
    }
  });

  data.disulfide_bonds.forEach(ss => {
    const k = computeK(ss.energy_kj_mol || 0, ss.distance);
    addStiffness(ss.residue_a.chain, ss.residue_a.number, k);
    addStiffness(ss.residue_b.chain, ss.residue_b.number, k);
  });

  data.pi_stacking.forEach(pi => {
    const k = computeK(pi.energy_kj_mol || 0, pi.distance);
    addStiffness(pi.residue_a.chain, pi.residue_a.number, k);
    addStiffness(pi.residue_b.chain, pi.residue_b.number, k);
  });

  data.hydrophobic_contacts.forEach(hc => {
    const k = computeK(hc.energy_kj_mol || 0, hc.distance);
    addStiffness(hc.residue_a.chain, hc.residue_a.number, k);
    addStiffness(hc.residue_b.chain, hc.residue_b.number, k);
  });

  // Calculate dynamic RMSF fluctuations: RMSF = 0.5 + 2.5 * sqrt(T / (1.0 + stiffness))
  const resFluc: Record<string, number> = {};
  const allResidueKeys = new Set<string>();

  // Register all residues in active dataset
  const listAll = [
    ...data.salt_bridges.flatMap(x => [x.positive_residue, x.negative_residue]),
    ...data.hydrogen_bonds.flatMap(x => [x.donor_residue, x.acceptor_residue]),
    ...data.disulfide_bonds.flatMap(x => [x.residue_a, x.residue_b]),
    ...data.pi_stacking.flatMap(x => [x.residue_a, x.residue_b]),
    ...data.hydrophobic_contacts.flatMap(x => [x.residue_a, x.residue_b]),
  ];

  listAll.forEach(res => {
    allResidueKeys.add(`${res.chain}_${res.number}`);
  });

  allResidueKeys.forEach(key => {
    const k = stiffnessMap[key] || 0;
    // Normalized RMSF: at 100K rigid regions are blue (fluc < 0.4), loop/flexible regions are amber.
    // At room temp (298.15K) it has a healthy blue/amber/red mix. At 500K it transitions to red.
    const fluc = 0.2 + 0.8 * Math.sqrt(tempK / 298.15) / (1.0 + k);
    resFluc[key] = Number(fluc.toFixed(3));
  });

  return {
    saltBridges,
    hydrogenBonds,
    disulfideBonds: data.disulfide_bonds,
    piStacking: data.pi_stacking,
    hydrophobicContacts: data.hydrophobic_contacts,
    resFluc,
  };
}

/**
 * Dijkstra mechanical shortest path algorithm to find the stress transmission route.
 */
export function findAllostericPath(
  data: RecalculatedState,
  sourceResKey: string,
  targetResKey: string
): string[] {
  // Graph represented as adjacency list
  const graph: Record<string, { node: string; weight: number }[]> = {};

  const addEdge = (u: string, v: string, energy: number) => {
    if (!graph[u]) graph[u] = [];
    if (!graph[v]) graph[v] = [];
    
    // Weight = 1.0 / (|E| + 0.1). Stronger bonds = lower weight/resistance.
    const w = 1.0 / (Math.abs(energy) + 0.1);
    graph[u].push({ node: v, weight: w });
    graph[v].push({ node: u, weight: w });
  };

  // Add all active (non-snapped) edges
  data.saltBridges.forEach(sb => {
    if (!sb.snapped) {
      addEdge(
        `${sb.positive_residue.chain}_${sb.positive_residue.number}`,
        `${sb.negative_residue.chain}_${sb.negative_residue.number}`,
        sb.energy_kj_mol || 0
      );
    }
  });

  data.hydrogenBonds.forEach(hb => {
    if (!hb.snapped) {
      addEdge(
        `${hb.donor_residue.chain}_${hb.donor_residue.number}`,
        `${hb.acceptor_residue.chain}_${hb.acceptor_residue.number}`,
        hb.energy_kj_mol || 0
      );
    }
  });

  data.disulfideBonds.forEach(ss => {
    addEdge(
      `${ss.residue_a.chain}_${ss.residue_a.number}`,
      `${ss.residue_b.chain}_${ss.residue_b.number}`,
      ss.energy_kj_mol || 0
    );
  });

  data.piStacking.forEach(pi => {
    addEdge(
      `${pi.residue_a.chain}_${pi.residue_a.number}`,
      `${pi.residue_b.chain}_${pi.residue_b.number}`,
      pi.energy_kj_mol || 0
    );
  });

  data.hydrophobicContacts.forEach(hc => {
    addEdge(
      `${hc.residue_a.chain}_${hc.residue_a.number}`,
      `${hc.residue_b.chain}_${hc.residue_b.number}`,
      hc.energy_kj_mol || 0
    );
  });

  if (!graph[sourceResKey] || !graph[targetResKey]) {
    return [];
  }

  // Dijkstra's algorithm
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const queue = new Set<string>();

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    previous[node] = null;
    queue.add(node);
  }

  distances[sourceResKey] = 0;

  while (queue.size > 0) {
    // Extract min distance node
    let minNode: string | null = null;
    let minDist = Infinity;
    for (const node of queue) {
      if (distances[node] < minDist) {
        minDist = distances[node];
        minNode = node;
      }
    }

    if (minNode === null || minNode === targetResKey) {
      break;
    }

    queue.delete(minNode);

    const neighbors = graph[minNode] || [];
    for (const neighbor of neighbors) {
      if (!queue.has(neighbor.node)) continue;
      const alt = distances[minNode] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = minNode;
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let curr: string | null = targetResKey;
  while (curr !== null) {
    path.push(curr);
    curr = previous[curr];
  }

  path.reverse();
  
  if (path[0] === sourceResKey) {
    return path;
  }
  return [];
}
