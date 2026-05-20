import { useState, useEffect } from 'react';
import {
  Dna,
  RefreshCw,
  Sparkles,
  Database,
  FileCheck,
  RotateCcw,
} from 'lucide-react';

import UploadZone from './components/UploadZone';
import Viewer3D from './components/Viewer3D';
import InteractionTable from './components/InteractionTable';
import {
  analyzeProtein,
  SaltBridge,
  HydrogenBond,
  DisulfideBond,
  PiStack,
  HydrophobicContact,
  AnalysisMetadata,
} from './utils/api';

// Reusable toggle row component
function ToggleRow({
  color,
  label,
  count,
  checked,
  onChange,
  id,
}: {
  color: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-900/40 border border-slate-800/50 cursor-pointer select-none transition">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full flex-shrink-0`} style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }} />
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">{count}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700"
        id={id}
      />
    </label>
  );
}

export default function App() {
  const [fileId, setFileId] = useState<string | null>('2b9e3144-ae88-469d-ab13-6ab9350f75df');
  const [filename, setFilename] = useState<string | null>('1ubq.pdb');
  const [extension, setExtension] = useState<string | null>('.pdb');

  // Interaction data
  const [saltBridges, setSaltBridges] = useState<SaltBridge[]>([]);
  const [hydrogenBonds, setHydrogenBonds] = useState<HydrogenBond[]>([]);
  const [disulfideBonds, setDisulfideBonds] = useState<DisulfideBond[]>([]);
  const [piStacking, setPiStacking] = useState<PiStack[]>([]);
  const [hydrophobicContacts, setHydrophobicContacts] = useState<HydrophobicContact[]>([]);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);

  // Visibility toggles
  const [showSaltBridges, setShowSaltBridges] = useState(true);
  const [showHydrogenBonds, setShowHydrogenBonds] = useState(true);
  const [showDisulfideBonds, setShowDisulfideBonds] = useState(true);
  const [showPiStacking, setShowPiStacking] = useState(true);
  const [showHydrophobic, setShowHydrophobic] = useState(true);

  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'checking' | 'offline'>('checking');

  // Debug console
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      const wLogs = (window as any).__app_logs || [];
      if (wLogs.length !== consoleLogs.length) {
        setConsoleLogs([...wLogs]);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [consoleLogs.length]);

  // Health check
  useEffect(() => {
    async function checkHealth() {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      try {
        const res = await fetch(apiUrl);
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch {
        setServerStatus('offline');
      }
    }
    checkHealth();
  }, []);

  // Auto-load analysis when file is set
  useEffect(() => {
    if (fileId && saltBridges.length === 0 && hydrogenBonds.length === 0) {
      runAnalysis(fileId);
    }
  }, [fileId]);

  async function runAnalysis(id: string, refresh = false) {
    setIsAnalyzing(true);
    try {
      const data = await analyzeProtein(id, refresh);
      setSaltBridges(data.salt_bridges ?? []);
      setHydrogenBonds(data.hydrogen_bonds ?? []);
      setDisulfideBonds(data.disulfide_bonds ?? []);
      setPiStacking(data.pi_stacking ?? []);
      setHydrophobicContacts(data.hydrophobic_contacts ?? []);
      setMetadata(data.metadata ?? null);
    } catch (err: any) {
      console.error('Failed to run analysis:', err);
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleUploadStart = () => {
    setError(null);
  };

  const handleUploadSuccess = async (id: string, name: string, ext: string) => {
    setFileId(id);
    setFilename(name);
    setExtension(ext);
    setSaltBridges([]);
    setHydrogenBonds([]);
    setDisulfideBonds([]);
    setPiStacking([]);
    setHydrophobicContacts([]);
    setMetadata(null);
    setSelectedInteractionId(null);
    await runAnalysis(id);
  };

  const handleUploadError = (err: string) => {
    setError(err);
  };

  const resetAll = () => {
    setFileId(null);
    setFilename(null);
    setExtension(null);
    setSaltBridges([]);
    setHydrogenBonds([]);
    setDisulfideBonds([]);
    setPiStacking([]);
    setHydrophobicContacts([]);
    setMetadata(null);
    setError(null);
    setSelectedInteractionId(null);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative pb-12">
      {/* Background animated mesh */}
      <div className="bg-mesh" />

      {/* Top Navigation / Header */}
      <header className="w-full glass-panel py-4 px-6 md:px-12 flex justify-between items-center z-40 sticky top-0 shadow-lg select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-neon-purple to-neon-cyan text-white shadow-lg animate-pulse">
            <Dna className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              BioInteract
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              3D Macromolecular Interactions
            </p>
          </div>
        </div>

        {/* Server Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-semibold hidden md:inline">API SERVER</span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
            serverStatus === 'online'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : serverStatus === 'checking'
              ? 'bg-slate-500/10 border-slate-500/25 text-slate-400 animate-pulse'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              serverStatus === 'online' ? 'bg-emerald-400' : serverStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-400'
            }`} />
            {serverStatus === 'online' ? 'Online' : serverStatus === 'checking' ? 'Connecting...' : 'Offline'}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column - Controls & Upload (Columns 1-4) */}
        <section className="lg:col-span-4 flex flex-col gap-6 w-full">

          {/* File Upload Card / Active File */}
          {!fileId ? (
            <div className="glass-panel p-6 rounded-2xl shadow-xl flex flex-col gap-4 border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-200">Select Protein Structure</h2>
                <p className="text-xs text-slate-400">Upload a molecular file to analyze interactions</p>
              </div>
              <UploadZone
                onUploadStart={handleUploadStart}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl shadow-xl flex flex-col gap-5 border border-slate-800">
              {/* Active file header */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="text-sm font-bold text-slate-200 truncate max-w-[180px]">{filename}</h2>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Uploaded Structure</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Re-analyze button */}
                  <button
                    onClick={() => fileId && runAnalysis(fileId, true)}
                    disabled={isAnalyzing}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-neon-purple/20 text-slate-400 hover:text-neon-purple transition disabled:opacity-40"
                    title="Force re-analysis (refresh cache)"
                    id="reanalyze-btn"
                  >
                    <RotateCcw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={resetAll}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                    title="Upload another file"
                    id="reset-protein-file-btn"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Visualization Toggles */}
              <div className="border-t border-slate-800/80 pt-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Visualization Layers
                </h3>

                <ToggleRow color="#06b6d4" label="Hydrogen Bonds" count={hydrogenBonds.length}
                  checked={showHydrogenBonds} onChange={setShowHydrogenBonds} id="toggle-hbonds-checkbox" />

                <ToggleRow color="#fbbf24" label="Salt Bridges" count={saltBridges.length}
                  checked={showSaltBridges} onChange={setShowSaltBridges} id="toggle-saltbridges-checkbox" />

                <ToggleRow color="#d4a017" label="Disulfide Bonds" count={disulfideBonds.length}
                  checked={showDisulfideBonds} onChange={setShowDisulfideBonds} id="toggle-disulfide-checkbox" />

                <ToggleRow color="#a855f7" label="π–π Stacking" count={piStacking.length}
                  checked={showPiStacking} onChange={setShowPiStacking} id="toggle-pistack-checkbox" />

                <ToggleRow color="#f97316" label="Hydrophobic Contacts" count={hydrophobicContacts.length}
                  checked={showHydrophobic} onChange={setShowHydrophobic} id="toggle-hydrophobic-checkbox" />
              </div>

              {/* Analyzing spinner */}
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-xs text-neon-cyan animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-neon-cyan animate-ping" />
                  Running molecular analysis…
                </div>
              )}
            </div>
          )}

          {/* Molecular Metadata Card */}
          {metadata && (
            <div className="glass-panel p-6 rounded-2xl shadow-xl flex flex-col gap-4 border border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-neon-purple" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Structure Metadata
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'TOTAL ATOMS', value: metadata.num_atoms },
                  { label: 'TOTAL RESIDUES', value: metadata.num_residues },
                  { label: 'PROTEIN RESIDUES', value: metadata.num_protein_residues },
                  { label: 'CHAINS / SEGMENTS', value: metadata.num_segments },
                  { label: 'H-BONDS', value: metadata.hbond_count },
                  { label: 'SALT BRIDGES', value: metadata.salt_bridge_count },
                  { label: 'DISULFIDE BONDS', value: metadata.disulfide_bond_count ?? 0 },
                  { label: 'π–π STACKING', value: metadata.pi_stacking_count ?? 0 },
                  { label: 'HYDROPHOBIC', value: metadata.hydrophobic_contact_count ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
                    <p className="text-base font-bold text-slate-200 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {metadata.hbond_warning && (
                <p className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  ⚠ {metadata.hbond_warning}
                </p>
              )}
            </div>
          )}

          {/* Error Message Panel */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex gap-3 text-rose-400 text-xs">
              <span className="font-bold">Error:</span>
              <p className="leading-relaxed">{error}</p>
            </div>
          )}
        </section>

        {/* Right Column - 3D Render & Tables (Columns 5-12) */}
        <section className="lg:col-span-8 flex flex-col gap-6 w-full">
          {!fileId ? (
            <div className="glass-panel p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="p-4 rounded-full bg-gradient-to-tr from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/20 text-neon-cyan mb-6">
                <Sparkles className="h-10 w-10 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Macromolecular Bond Visualization Engine
              </h2>
              <p className="text-slate-400 text-sm max-w-lg mt-3 leading-relaxed">
                An advanced computational platform to parse structures, automatically detect 5 types of molecular interactions, and render full interactome networks in WebGL.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl mt-10">
                {[
                  { step: 1, color: 'text-neon-cyan', title: 'Upload File', desc: 'Select a .pdb, .cif or .mmcif macromolecular file.' },
                  { step: 2, color: 'text-neon-purple', title: 'Backend Analysis', desc: 'MDAnalysis detects 5 interaction types automatically.' },
                  { step: 3, color: 'text-neon-yellow', title: 'Explore in 3D', desc: 'Toggle each interaction layer and zoom to any bond.' },
                ].map(({ step, color, title, desc }) => (
                  <div key={step} className="flex flex-col items-center p-4 bg-slate-900/10 rounded-xl border border-slate-800/40">
                    <div className={`h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold ${color} mb-2`}>{step}</div>
                    <h4 className="text-xs font-bold text-slate-200">{title}</h4>
                    <p className="text-[10px] text-slate-400 text-center mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 w-full">
              {/* Mol* 3D Viewer */}
              <div className="h-[500px] w-full">
                <Viewer3D
                  fileId={fileId}
                  extension={extension}
                  saltBridges={saltBridges}
                  hydrogenBonds={hydrogenBonds}
                  disulfideBonds={disulfideBonds}
                  piStacking={piStacking}
                  hydrophobicContacts={hydrophobicContacts}
                  showSaltBridges={showSaltBridges}
                  showHydrogenBonds={showHydrogenBonds}
                  showDisulfideBonds={showDisulfideBonds}
                  showPiStacking={showPiStacking}
                  showHydrophobic={showHydrophobic}
                  selectedInteractionId={selectedInteractionId}
                  onSelectInteraction={setSelectedInteractionId}
                />
              </div>

              {/* Interaction Tables */}
              <div className="w-full">
                <InteractionTable
                  saltBridges={saltBridges}
                  hydrogenBonds={hydrogenBonds}
                  disulfideBonds={disulfideBonds}
                  piStacking={piStacking}
                  hydrophobicContacts={hydrophobicContacts}
                  selectedInteractionId={selectedInteractionId}
                  onSelectInteraction={setSelectedInteractionId}
                  hbondMethod={metadata?.hbond_method}
                  hbondWarning={metadata?.hbond_warning}
                />
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Dev Console Log Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        {showConsole && (
          <div className="w-[500px] h-[250px] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col mb-2 overflow-hidden font-mono text-[10px] backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
              <span className="text-slate-400 font-bold">App Runtime Diagnostics</span>
              <button
                onClick={() => { (window as any).__app_logs = []; setConsoleLogs([]); }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 text-[9px]"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 select-text">
              {consoleLogs.length === 0 ? (
                <div className="text-slate-600 italic">No logs captured yet.</div>
              ) : (
                consoleLogs.map((log, i) => {
                  let color = 'text-slate-400';
                  if (log.startsWith('[ERROR]') || log.startsWith('[UNHANDLED')) color = 'text-rose-400 font-semibold';
                  else if (log.startsWith('[WARN]')) color = 'text-amber-400';
                  return <div key={i} className={`${color} break-all leading-normal`}>{log}</div>;
                })
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setShowConsole(!showConsole)}
          className={`p-3 rounded-full flex items-center justify-center shadow-xl border select-none transition ${
            showConsole
              ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          id="dev-console-toggle-btn"
        >
          <Dna className={`h-5 w-5 ${showConsole ? 'animate-pulse' : ''}`} />
        </button>
      </div>
    </div>
  );
}
