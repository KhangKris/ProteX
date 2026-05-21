"""
NVIDIA NIM OpenFold 3 API Client
Predicts 3D biomolecular structures from protein/DNA/RNA/ligand sequences.
"""

import os
import httpx
import logging
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("nim_client")

NIM_URL = os.getenv(
    "NIM_URL",
    "https://health.api.nvidia.com/v1/biology/openfold/openfold3/predict"
)


class NIMError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"NIM API error {status_code}: {detail}")


class NIMClient:
    """
    Synchronous client for NVIDIA NIM OpenFold 3 using HTTPX.

    Usage:
        client = NIMClient()
        result = client.predict(
            molecules=[
                {"type": "protein", "sequence": "MGREEPLNH...", "id": "A"},
                {"type": "dna", "sequence": "AGGAACACGTGACCC", "id": "B"},
                {"type": "dna", "sequence": "TGGGTCACGTGTTCC", "id": "C"},
            ]
        )
        pdb_content = result["structure"]
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY", "")

    def _build_msa_csv(self, sequence: str) -> str:
        """Build minimal CSV MSA from the sequence itself (self-alignment)."""
        return f"key,sequence\n-1,{sequence}"

    def predict(
        self,
        molecules: List[Dict[str, Any]],
        request_id: str = "prediction",
        output_format: str = "pdb",
    ) -> Dict[str, Any]:
        """
        Call OpenFold 3 NIM API to predict structure.
        """
        if not self.api_key:
            raise NIMError(401, "No NVIDIA API key. Set NVIDIA_API_KEY in .env")

        processed = []
        for mol in molecules:
            mol_type = mol["type"].lower()
            entry: Dict[str, Any] = {"type": mol_type}

            if "id" in mol and mol["id"]:
                entry["id"] = mol["id"]

            if mol_type == "protein":
                entry["sequence"] = mol["sequence"]
                # Build CSV MSA (required for protein)
                msa_csv = self._build_msa_csv(mol["sequence"])
                entry["msa"] = {
                    "main_db": {
                        "csv": {
                            "alignment": msa_csv,
                            "format": "csv",
                        }
                    }
                }

            elif mol_type in ("dna", "rna"):
                entry["sequence"] = mol["sequence"]

            elif mol_type == "ligand":
                if "smiles" in mol:
                    entry["smiles"] = mol["smiles"]
                elif "ccd_codes" in mol:
                    entry["ccd_codes"] = mol["ccd_codes"]

            processed.append(entry)

        data = {
            "request_id": request_id,
            "inputs": [{
                "input_id": request_id,
                "molecules": processed,
                "output_format": output_format,
            }]
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "NVCF-POLL-SECONDS": "300",  # Long-poll up to 5 min
        }

        logger.info(f"Calling NIM OpenFold 3: {len(molecules)} molecule(s)")

        try:
            with httpx.Client(timeout=600.0) as client:
                response = client.post(
                    NIM_URL,
                    headers=headers,
                    json=data,
                )
        except httpx.TimeoutException:
            raise NIMError(504, "Request timed out. Large sequences can take several minutes.")
        except httpx.ConnectError:
            raise NIMError(503, "Could not connect to NVIDIA NIM API.")

        if response.status_code != 200:
            detail = response.text[:500]
            try:
                err = response.json()
                detail = err.get("detail", err.get("message", detail))
            except Exception:
                pass
            raise NIMError(response.status_code, str(detail))

        # Parse response
        result = response.json()
        outputs = result.get("outputs", [])
        if not outputs:
            raise NIMError(500, "NIM returned empty outputs")

        structures = outputs[0].get("structures_with_scores", [])
        if not structures:
            raise NIMError(500, "NIM returned no predicted structures")

        best = structures[0]

        return {
            "structure": best.get("structure", ""),
            "format": best.get("format", output_format),
            "confidence_score": round(best.get("confidence_score", 0.0), 4),
            "complex_plddt_score": round(best.get("complex_plddt_score", 0.0), 4),
            "complex_pde_score": round(best.get("complex_pde_score", 0.0), 4),
            "ptm_score": round(best.get("ptm_score", 0.0), 4),
            "iptm_score": round(best.get("iptm_score", 0.0), 4),
        }

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)
