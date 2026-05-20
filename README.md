# BioInteract — Protein Interaction Analysis & 3D Visualization

BioInteract is a production-style, multi-layered computational biology platform for loading structural files (`.pdb`, `.cif`, `.mmcif`), performing electrostatic and hydrogen bond interactions calculations on a scientific Python engine, and displaying the macromolecule and bonds interactively in WebGL.

---

## System Architecture

The platform is strictly decoupled into three layers:
1. **Scientific Analysis Backend**: Custom Python algorithms + `MDAnalysis` + `SciPy` to parser coordinates and locate bonds.
2. **API Backend**: `FastAPI` (Python) serving a RESTful interface for uploads and asynchronous execution.
3. **3D Visualization Client**: A modern `React` + `TypeScript` + `Vite` SPA powered by the `Mol*` WebGL viewer and `TailwindCSS`.

---

## Scientific Implementation

### 1. Salt Bridge Detection (Electrostatic)
Salt bridges occur between positively charged nitrogen atoms in basic residues and negatively charged oxygen atoms in acidic residues.

*   **Positive Residues**: `LYS` (nitrogen atom: `NZ`) and `ARG` (nitrogen atoms: `NH1`, `NH2`).
*   **Negative Residues**: `ASP` (oxygen atoms: `OD1`, `OD2`) and `GLU` (oxygen atoms: `OE1`, `OE2`).
*   **Algorithm**:
    1. Select all matching positive and negative atoms from the structure.
    2. Compute the pair-wise Euclidean distance matrix using `scipy.spatial.distance.cdist`:
       $$\text{distance} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}$$
    3. If the distance is **$< 4.0\text{ \AA}$**, classify as a salt bridge.
    4. Return coordinates, atom IDs, residue info, and distance.

### 2. Hydrogen Bond Detection
Using MDAnalysis `HydrogenBondAnalysis` toolset under the following criteria:
*   **Distance**: Donor-Acceptor distance **$< 3.5\text{ \AA}$**.
*   **Angle**: Donor-Hydrogen-Acceptor (D-H-A) angle **$> 120^\circ$**.

> [!NOTE]
> **Fallback Mechanism for Hydrogen-Free PDBs**
> Since many standard PDB files do not contain hydrogen coordinates, a native MDAnalysis run will yield empty results. BioInteract automatically detects this, warning the user, and initiates a **Donor-Acceptor Fallback Analyzer** mapping N, O, and S atoms within $3.5\text{ \AA}$ to ensure molecular interactions are still displayed.

---

## Directory Structure

```
.
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── uploads/               # Directory for temporary file storage & JSON caches
│   └── analysis/
│       ├── __init__.py
│       ├── parser.py          # Structure loader & metadata parser
│       ├── salt_bridges.py    # Custom salt-bridge logic
│       ├── hbonds.py          # Hydrogen Bond Analyzer + Fallback mode
│       └── utils.py           # Logging & file garbage collection
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── Dockerfile
    └── src/
        ├── main.tsx
        ├── App.tsx            # Main layout with sidebars & panels
        ├── index.css
        ├── components/
        │   ├── Viewer3D.tsx   # Mol* WebGL integration & custom Shape generator
        │   ├── UploadZone.tsx # Drag-and-drop file uploader
        │   └── InteractionTable.tsx # Tabbed interaction spreadsheet
        └── utils/
            └── api.ts         # Axios/Fetch client and type definitions
```

---

## API Layer Documentation

### 1. Upload Structure
*   **Endpoint**: `POST /upload`
*   **Request**: `multipart/form-data` with `file: UploadFile`
*   **Response**:
    ```json
    {
      "file_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "filename": "1ubq.pdb",
      "extension": ".pdb",
      "status": "uploaded"
    }
    ```

### 2. Run Interaction Analysis
*   **Endpoint**: `POST /analyze`
*   **Request Body**:
    ```json
    {
      "file_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }
    ```
*   **Response**:
    ```json
    {
      "hydrogen_bonds": [
        {
          "id": "hb_12_45",
          "distance": 2.84,
          "angle": 155.0,
          "fallback": false,
          "donor_residue": { "name": "GLY", "number": 10, "chain": "A" },
          "donor_atom": { "id": 12, "name": "N", "coordinates": [10.2, 4.5, -3.2] },
          "hydrogen_atom": { "id": 13, "name": "H", "coordinates": [10.5, 4.8, -2.9] },
          "acceptor_residue": { "name": "VAL", "number": 15, "chain": "A" },
          "acceptor_atom": { "id": 45, "name": "O", "coordinates": [12.1, 3.2, -5.1] }
        }
      ],
      "salt_bridges": [
        {
          "id": "sb_102_204",
          "distance": 3.21,
          "positive_residue": { "name": "LYS", "number": 27, "chain": "A" },
          "positive_atom": { "id": 102, "name": "NZ", "coordinates": [15.2, 11.2, 4.3] },
          "negative_residue": { "name": "ASP", "number": 52, "chain": "A" },
          "negative_atom": { "id": 204, "name": "OD1", "coordinates": [17.5, 9.4, 5.1] }
        }
      ],
      "metadata": {
        "num_atoms": 602,
        "num_residues": 76,
        "num_segments": 1,
        "hbond_method": "MDAnalysis.HydrogenBondAnalysis",
        "hbond_warning": null
      }
    }
    ```

### 3. Get Analysis Results (Cached)
*   **Endpoint**: `GET /results/{id}`
*   **Response**: Same as `POST /analyze` (returns cached version if computed).

### 4. Serve Structure File
*   **Endpoint**: `GET /files/{id}`
*   **Response**: Raw file stream (used by Mol* Viewer to render structure).

---

## Run and Deploy (Docker Compose)

Launch both backend and frontend environments in one command.

### 1. Start Services
```bash
docker-compose up --build
```
This builds and initializes:
- **Frontend client** running at: `http://localhost:5173`
- **FastAPI backend** running at: `http://localhost:8000`

### 2. Stopping Container Services
```bash
docker-compose down
```
