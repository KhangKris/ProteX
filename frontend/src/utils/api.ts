const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ResidueInfo {
  name: string;
  number: number;
  chain: string;
}

export interface AtomInfo {
  id: number;
  name: string;
  coordinates: [number, number, number];
}

export interface SaltBridge {
  id: string;
  distance: number;
  positive_residue: ResidueInfo;
  positive_atom: AtomInfo;
  negative_residue: ResidueInfo;
  negative_atom: AtomInfo;
}

export interface HydrogenBond {
  id: string;
  distance: number;
  angle: number | null;
  fallback: boolean;
  donor_residue: ResidueInfo;
  donor_atom: AtomInfo;
  hydrogen_atom: AtomInfo | null;
  acceptor_residue: ResidueInfo;
  acceptor_atom: AtomInfo;
}

export interface DisulfideBond {
  id: string;
  distance: number;
  residue_a: ResidueInfo;
  atom_a: AtomInfo;
  residue_b: ResidueInfo;
  atom_b: AtomInfo;
}

export interface PiStack {
  id: string;
  distance: number;
  angle: number;
  stack_type: 'parallel' | 't-shaped';
  centroid_a: [number, number, number];
  centroid_b: [number, number, number];
  residue_a: ResidueInfo;
  residue_b: ResidueInfo;
}

export interface HydrophobicContact {
  id: string;
  distance: number;
  residue_a: ResidueInfo;
  atom_a: AtomInfo;
  residue_b: ResidueInfo;
  atom_b: AtomInfo;
}

export interface AnalysisMetadata {
  num_atoms: number;
  num_residues: number;
  num_segments: number;
  num_protein_atoms: number;
  num_protein_residues: number;
  unique_residues: string[];
  file_id: string;
  hbond_method: string;
  hbond_warning: string | null;
  salt_bridge_count: number;
  hbond_count: number;
  disulfide_bond_count: number;
  pi_stacking_count: number;
  hydrophobic_contact_count: number;
}

export interface AnalysisResponse {
  hydrogen_bonds: HydrogenBond[];
  salt_bridges: SaltBridge[];
  disulfide_bonds: DisulfideBond[];
  pi_stacking: PiStack[];
  hydrophobic_contacts: HydrophobicContact[];
  metadata: AnalysisMetadata;
}

export interface UploadResponse {
  file_id: string;
  filename: string;
  extension: string;
  status: string;
}

export async function uploadProteinFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to upload file' }));
    throw new Error(errorData.detail || 'Failed to upload file');
  }

  return response.json();
}

export async function analyzeProtein(fileId: string, refresh = false): Promise<AnalysisResponse> {
  const url = refresh ? `${API_URL}/analyze?refresh=true` : `${API_URL}/analyze`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Analysis failed' }));
    throw new Error(errorData.detail || 'Analysis failed');
  }

  return response.json();
}

export function getFileUrl(fileId: string): string {
  return `${API_URL}/files/${fileId}`;
}
