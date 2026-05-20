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
      className={`relative w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-350 select-none flex flex-col items-center justify-center min-h-[220px] ${
        isDragActive
          ? 'border-neon-cyan bg-slate-900/60 shadow-[0_0_25px_rgba(6,182,212,0.15)] scale-[1.01]'
          : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/30'
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-neon-cyan animate-spin" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">Uploading Macromolecule...</h3>
            <p className="text-xs text-slate-400">Sending structural coordinates to scientific backend</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-full transition-all duration-300 ${
            isDragActive ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-slate-900 text-slate-400'
          }`}>
            {isDragActive ? (
              <FileCode className="h-8 w-8 animate-bounce" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </div>
          
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-200">
              Drag & Drop your structural file here
            </h3>
            <p className="text-xs text-slate-400">
              or click to browse local files (Supports <span className="text-neon-cyan font-semibold">.pdb</span>, <span className="text-neon-cyan font-semibold">.cif</span>, <span className="text-neon-cyan font-semibold">.mmcif</span> formats)
            </p>
          </div>
          
          <div className="flex gap-2.5 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">PDB</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">mmCIF</span>
          </div>
        </div>
      )}
    </div>
  );
}
