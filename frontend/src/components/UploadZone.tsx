import { useState, useRef } from 'react';
import { Upload, FileCode, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onUploadSuccess: (fileId: string, filename: string, extension: string) => void;
  onUploadStart: () => void;
  onUploadError: (err: string) => void;
}

export default function UploadZone({
  onUploadSuccess,
  onUploadStart,
  onUploadError,
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdb', '.cif', '.mmcif'].includes(ext)) {
      onUploadError('Invalid format. Only .pdb, .cif, and .mmcif structure files are supported.');
      return;
    }

    setLoading(true);
    onUploadStart();

    // Call API client
    try {
      const { uploadProteinFile } = await import('../utils/api');
      const response = await uploadProteinFile(file);
      onUploadSuccess(response.file_id, response.filename, response.extension);
    } catch (err: any) {
      console.error(err);
      onUploadError(err.message || 'Network error occurred while uploading file');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => !loading && fileInputRef.current?.click()}
      id="upload-zone-container"
      className={`relative w-full border border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center min-h-[220px] ${
        isDragActive
          ? 'border-cyan-555 bg-cyan-950/15 shadow-[0_0_20px_rgba(6,182,212,0.1)] scale-[1.01]'
          : 'border-slate-900 bg-slate-950/30 hover:border-slate-800 hover:bg-slate-950/60'
      } ${loading ? 'pointer-events-none opacity-80' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdb,.cif,.mmcif"
        onChange={handleFileChange}
        className="hidden"
        id="pdb-file-uploader-input"
      />

      {loading ? (
        <div className="flex flex-col items-center gap-4 font-mono">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-205 uppercase">[UPLOADING_MACROMOLECULE...]</h3>
            <p className="text-[9px] text-slate-500 uppercase">streaming coordinate telemetry to server</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 font-mono">
          <div className={`p-3 rounded border transition-all duration-200 ${
            isDragActive ? 'bg-cyan-950/50 border-cyan-800/40 text-cyan-400' : 'bg-slate-950 border-slate-900 text-slate-500'
          }`}>
            {isDragActive ? (
              <FileCode className="h-6 w-6 animate-bounce" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-200 uppercase">
              [DRAG_PDB_STRUCTURE_HERE]
            </h3>
            <p className="text-[9px] text-slate-500 uppercase">
              or click to stream local file coordinates
            </p>
          </div>
          
          <div className="flex gap-2 mt-2 select-none">
            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-slate-900 border border-slate-850 text-slate-500 uppercase">pdb_format</span>
            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-slate-900 border border-slate-850 text-slate-500 uppercase">cif_format</span>
          </div>
        </div>
      )}
    </div>
  );
}
