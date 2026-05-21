import { useState, useEffect } from 'react';
import {
  Dna,
  RefreshCw,
  Sparkles,
  Database,
  FileCheck,
  RotateCcw,
  Upload,
  FlaskConical,
} from 'lucide-react';

import UploadZone from './components/UploadZone';
import Viewer3D from './components/Viewer3D';
import InteractionTable from './components/InteractionTable';
import SequenceInput from './components/SequenceInput';
import {
  analyzeProtein,
  SaltBridge,
  HydrogenBond,
  DisulfideBond,
  PiStack,
  HydrophobicContact,
  AnalysisMetadata,
  PredictResponse,
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

import { recalculateEnvironmentalForces, findAllostericPath } from './utils/physicsEngine';

export default function App() {
  const [fileId, setFileId] = useState<string | null>('2b9e3144-ae88-469d-ab13-6ab9350f75df');
  const [filename, setFilename] = useState<string | null>('1ubq.pdb');
  const [extension, setExtension] = useState<string | null>('.pdb');

  // Input mode: "upload" or "predict"
  const [inputMode, setInputMode] = useState<'upload' | 'predict'>('upload');

  // Raw backend interaction data
  const [rawSaltBridges, setRawSaltBridges] = useState<SaltBridge[]>([]);
  const [rawHydrogenBonds, setRawHydrogenBonds] = useState<HydrogenBond[]>([]);
  const [rawDisulfideBonds, setRawDisulfideBonds] = useState<DisulfideBond[]>([]);
  const [rawPiStacking, setRawPiStacking] = useState<PiStack[]>([]);
  const [rawHydrophobicContacts, setRawHydrophobicContacts] = useState<HydrophobicContact[]>([]);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);

  // Environmental and Allosteric Simulation States
  const [pH, setPH] = useState(7.0);
  const [temperature, setTemperature] = useState(298.15); // Kelvin (room temp)
  const [colorMode, setColorMode] = useState<'default' | 'rmsf' | 'allosteric'>('default');
  const [allostericSource, setAllostericSource] = useState<string>('');
  const [allostericTarget, setAllostericTarget] = useState<string>('');

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

  // Real-time environmental recalculations
  const recalculated = recalculateEnvironmentalForces(
    {
      salt_bridges: rawSaltBridges,
      hydrogen_bonds: rawHydrogenBonds,
      disulfide_bonds: rawDisulfideBonds,
      pi_stacking: rawPiStacking,
      hydrophobic_contacts: rawHydrophobicContacts,
    },
    pH,
    temperature
  );

  const saltBridges = recalculated.saltBridges;
  const hydrogenBonds = recalculated.hydrogenBonds;
  const disulfideBonds = recalculated.disulfideBonds;
  const piStacking = recalculated.piStacking;
  const hydrophobicContacts = recalculated.hydrophobicContacts;
  const resFluc = recalculated.resFluc;

  // Derive sorted unique residues for Allosteric Path drop downs
  const availableResidues = Array.from(new Set(
    [
      ...rawSaltBridges.flatMap(x => [x.positive_residue, x.negative_residue]),
      ...rawHydrogenBonds.flatMap(x => [x.donor_residue, x.acceptor_residue]),
      ...rawDisulfideBonds.flatMap(x => [x.residue_a, x.residue_b]),
      ...rawPiStacking.flatMap(x => [x.residue_a, x.residue_b]),
      ...rawHydrophobicContacts.flatMap(x => [x.residue_a, x.residue_b]),
    ].map(r => `${r.chain}_${r.number}_${r.name}`)
  )).sort((a, b) => {
    const [c1, n1] = a.split('_');
    const [c2, n2] = b.split('_');
    if (c1 !== c2) return c1.localeCompare(c2);
    return Number(n1) - Number(n2);
  });

  // Calculate stress transmission path via Dijkstra
  const allostericPath = (allostericSource && allostericTarget)
    ? findAllostericPath(recalculated, allostericSource.split('_').slice(0, 2).join('_'), allostericTarget.split('_').slice(0, 2).join('_'))
    : [];

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
    if (fileId && rawSaltBridges.length === 0 && rawHydrogenBonds.length === 0) {
      runAnalysis(fileId);
    }
  }, [fileId]);

  async function runAnalysis(id: string, refresh = false) {
    setIsAnalyzing(true);
    try {
      const data = await analyzeProtein(id, refresh);
      setRawSaltBridges(data.salt_bridges ?? []);
      setRawHydrogenBonds(data.hydrogen_bonds ?? []);
      setRawDisulfideBonds(data.disulfide_bonds ?? []);
      setRawPiStacking(data.pi_stacking ?? []);
      setRawHydrophobicContacts(data.hydrophobic_contacts ?? []);
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
    setRawSaltBridges([]);
    setRawHydrogenBonds([]);
    setRawDisulfideBonds([]);
    setRawPiStacking([]);
    setRawHydrophobicContacts([]);
    setMetadata(null);
    setSelectedInteractionId(null);
    await runAnalysis(id);
  };

  const handleUploadError = (err: string) => {
    setError(err);
  };

  const handlePredictionComplete = (result: PredictResponse) => {
    setFileId(result.file_id);
    setFilename(`predicted_${result.file_id.slice(0, 8)}${result.extension}`);
    setExtension(result.extension);
    const a = result.analysis;
    setRawSaltBridges(a.salt_bridges ?? []);
    setRawHydrogenBonds(a.hydrogen_bonds ?? []);
    setRawDisulfideBonds(a.disulfide_bonds ?? []);
    setRawPiStacking(a.pi_stacking ?? []);
    setRawHydrophobicContacts(a.hydrophobic_contacts ?? []);
    setMetadata(a.metadata ?? null);
    setSelectedInteractionId(null);
    setError(null);
  };

  const resetAll = () => {
    setFileId(null);
    setFilename(null);
    setExtension(null);
    setRawSaltBridges([]);
    setRawHydrogenBonds([]);
    setRawDisulfideBonds([]);
    setRawPiStacking([]);
    setRawHydrophobicContacts([]);
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

          {/* Mode Tabs + Input */}
          {!fileId ? (
            <div className="glass-panel p-6 rounded-2xl shadow-xl flex flex-col gap-4 border border-slate-800">
              {/* Mode Switch Tabs */}
              <div className="flex gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                <button
                  onClick={() => setInputMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputMode === 'upload'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                  id="mode-upload-btn"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  onClick={() => setInputMode('predict')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputMode === 'predict'
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                  id="mode-predict-btn"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Predict from Sequence
                </button>
              </div>

              {/* Upload Mode */}
              {inputMode === 'upload' && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-slate-200">Upload Structure File</h2>
                    <p className="text-xs text-slate-400">Upload a .pdb, .cif or .mmcif file to analyze</p>
                  </div>
                  <UploadZone
                    onUploadStart={handleUploadStart}
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={handleUploadError}
                  />
                </>
              )}

              {/* Predict Mode */}
              {inputMode === 'predict' && (
                <SequenceInput onPredictionComplete={handlePredictionComplete} />
              )}
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

          {/* Environmental Simulation Chamber & Allosteric Network Card */}
          {fileId && (
            <div className="glass-panel p-6 rounded-2xl shadow-xl flex flex-col gap-5 border border-slate-800">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4.5 w-4.5 text-neon-cyan animate-pulse" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Environmental Chamber & Stress Network
                </h3>
              </div>

              {/* pH & Temperature Sliders */}
              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1">
                    <span className="text-slate-400">Solution pH</span>
                    <span className="text-cyan-400 font-mono font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/20">{pH.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="14"
                    step="0.1"
                    value={pH}
                    onChange={(e) => setPH(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-900 border-none rounded-lg h-1.5 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                    <span>Acidic (pH 0)</span>
                    <span>Neutral (7)</span>
                    <span>Basic (14)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1">
                    <span className="text-slate-400">Temperature (T)</span>
                    <span className="text-purple-400 font-mono font-bold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/20">{temperature.toFixed(0)} K</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="500"
                    step="1"
                    value={temperature}
                    onChange={(e) => {
                      setTemperature(parseFloat(e.target.value));
                      if (colorMode === 'default') {
                        setColorMode('rmsf');
                      }
                    }}
                    className="w-full accent-purple-400 bg-slate-900 border-none rounded-lg h-1.5 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                    <span>Cryogenic (100 K)</span>
                    <span>Room Temp (298 K)</span>
                    <span>Denaturing (500 K)</span>
                  </div>
                </div>
              </div>

              {/* 3D Color Mode Toggle */}
              <div className="border-t border-slate-800/80 pt-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Structure Color Theme
                </h4>
                <div className="flex gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                  {[
                    { mode: 'default', label: 'Default' },
                    { mode: 'rmsf', label: 'Thermal Fluctuations' },
                    { mode: 'allosteric', label: 'Stress Path' },
                  ].map((x) => (
                    <button
                      key={x.mode}
                      onClick={() => setColorMode(x.mode as any)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold tracking-wide uppercase transition-all ${
                        colorMode === x.mode
                          ? 'bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-inner'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Allosteric Dijkstra Path Selection */}
              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Allosteric Mechanical Pathway
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Source node</label>
                    <select
                      value={allostericSource}
                      onChange={(e) => {
                        setAllostericSource(e.target.value);
                        setColorMode('allosteric');
                      }}
                      className="w-full text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 focus:ring-0"
                    >
                      <option value="">-- Choose --</option>
                      {availableResidues.map(res => (
                        <option key={res} value={res}>{res.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Target node</label>
                    <select
                      value={allostericTarget}
                      onChange={(e) => {
                        setAllostericTarget(e.target.value);
                        setColorMode('allosteric');
                      }}
                      className="w-full text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 focus:ring-0"
                    >
                      <option value="">-- Choose --</option>
                      {availableResidues.map(res => (
                        <option key={res} value={res}>{res.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {allostericSource && allostericTarget && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[10px]">
                    {allostericPath.length > 0 ? (
                      <div>
                        <p className="text-purple-300 font-bold mb-1">Path Found ({allostericPath.length} steps):</p>
                        <p className="text-slate-400 break-words font-mono">{allostericPath.join(' → ')}</p>
                      </div>
                    ) : (
                      <p className="text-rose-400 italic">No mechanical bond pathway connects these residues.</p>
                    )}
                  </div>
                )}
              </div>
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

              {/* Confidence scores (when predicted via NIM) */}
              {metadata.prediction_source && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <p className="text-[10px] text-purple-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    OpenFold 3 Prediction Confidence
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'pLDDT', value: metadata.complex_plddt_score, max: 100 },
                      { label: 'pTM', value: metadata.ptm_score, max: 1 },
                      { label: 'ipTM', value: metadata.iptm_score, max: 1 },
                      { label: 'Confidence', value: metadata.confidence_score, max: 1 },
                    ].map(({ label, value, max }) => {
                      const pct = value != null ? (value / max) * 100 : 0;
                      const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                      return (
                        <div key={label} className="p-2 bg-slate-950/40 rounded-lg">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">{label}</span>
                            <span className="text-white font-bold">{value != null ? (max === 100 ? value.toFixed(1) : value.toFixed(3)) : '—'}</span>
                          </div>
                          <div className="h-1 mt-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                Upload a structure file or predict from amino acid / nucleotide sequences using NVIDIA OpenFold 3.
                Automatically detect 5 types of molecular interactions with energy estimates.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mt-10">
                <button
                  onClick={() => setInputMode('upload')}
                  className="flex flex-col items-center p-6 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all group cursor-pointer"
                  id="hero-upload-btn"
                >
                  <Upload className="h-8 w-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-white">Upload Structure</h4>
                  <p className="text-[11px] text-slate-400 mt-1">.pdb, .cif, .mmcif files</p>
                </button>
                <button
                  onClick={() => setInputMode('predict')}
                  className="flex flex-col items-center p-6 bg-purple-500/5 hover:bg-purple-500/10 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group cursor-pointer"
                  id="hero-predict-btn"
                >
                  <FlaskConical className="h-8 w-8 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-white">Predict from Sequence</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Protein · DNA · RNA · Ligand</p>
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-6">Powered by NVIDIA NIM OpenFold 3 + MDAnalysis</p>
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
                  resFluc={resFluc}
                  allostericPath={allostericPath}
                  colorMode={colorMode}
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
