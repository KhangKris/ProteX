import { useState, useEffect } from 'react';
import {
  Dna,
  Sparkles,
  Database,
  RotateCcw,
  FlaskConical,
  Activity,
  Terminal,
  X,
  ShieldAlert,
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
import { recalculateEnvironmentalForces, findAllostericPath } from './utils/physicsEngine';

// Reusable toggle row component designed as a hardware channel switch
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
    <label className="flex items-center justify-between p-2 rounded hover:bg-white/[0.02] cursor-pointer group transition-all select-none">
      <div className="flex items-center gap-2.5">
        <div 
          className="h-1.5 w-1.5 rounded-full transition-all duration-300 group-hover:scale-125" 
          style={{ 
            backgroundColor: color, 
            boxShadow: checked ? `0 0 8px ${color}` : 'none',
            opacity: checked ? 1 : 0.2
          }} 
        />
        <span className={`text-[10px] font-bold uppercase tracking-tight transition-colors ${checked ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono font-bold text-slate-600 bg-white/[0.02] px-1 rounded border border-white/[0.03]">
          {String(count).padStart(2, '0')}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="hidden"
          id={id}
        />
        <div className={`w-6 h-3 rounded-full relative transition-all ${checked ? 'bg-cyan-500/40 border border-cyan-500/20' : 'bg-white/5 border border-white/5'}`}>
          <div className={`absolute top-0.5 w-1.5 h-1.5 rounded-full transition-all ${checked ? 'right-0.5 bg-cyan-400' : 'left-0.5 bg-slate-700'}`} />
        </div>
      </div>
    </label>
  );
}

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className="h-screen bg-[#020202] text-slate-300 flex flex-col overflow-hidden font-mono">
      {/* Background Micro-Grid */}
      <div className="bg-grid-lab fixed inset-0 opacity-20 pointer-events-none" />

      {/* Global Lab Header */}
      <header className="h-14 shrink-0 border-b border-white/[0.05] flex items-center justify-between px-6 z-50 bg-[#020202]/80 backdrop-blur-xl select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <Dna className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xs font-bold tracking-tighter text-white uppercase">
                ProFoldlab // Orbital Lab
              </h1>
              <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">
                Structural Mechanical Spectrometry
              </span>
            </div>
          </div>
          
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] uppercase font-bold ${
              serverStatus === 'online' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}>
              <div className={`h-1 w-1 rounded-full ${serverStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {serverStatus}
            </div>
            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">v3.42-NIM</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {fileId && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/[0.05] rounded shadow-inner">
              <span className="text-[9px] text-slate-600 font-bold uppercase">Stream_ID:</span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase truncate max-w-[120px]">{filename}</span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2 rounded border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] transition-all ${isSidebarCollapsed ? 'text-slate-600' : 'text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'}`}
            title="Toggle Dashboard Sidebar"
          >
            <Terminal className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Controller */}
        <aside className={`${isSidebarCollapsed ? 'w-0' : 'w-80'} shrink-0 border-r border-white/[0.05] flex flex-col bg-[#050505] sidebar-transition overflow-hidden relative z-50`}>
          <div className="p-5 flex flex-col gap-6 overflow-y-auto scrollbar-thin h-full">
            
            {/* IO Channel Deck */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
                <span className="instrument-label text-slate-500">[IO_CHANNEL_DECK]</span>
                <div className="flex gap-1 bg-black/40 p-0.5 rounded border border-white/[0.03]">
                  <button 
                    onClick={() => setInputMode('upload')} 
                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${inputMode === 'upload' ? 'bg-white/[0.05] text-cyan-400 shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    Load
                  </button>
                  <button 
                    onClick={() => setInputMode('predict')} 
                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${inputMode === 'predict' ? 'bg-white/[0.05] text-purple-400 shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    Predict
                  </button>
                </div>
              </div>

              {!fileId ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                  {inputMode === 'upload' ? (
                    <UploadZone onUploadStart={handleUploadStart} onUploadSuccess={handleUploadSuccess} onUploadError={handleUploadError} />
                  ) : (
                    <SequenceInput onPredictionComplete={handlePredictionComplete} />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                   <div className="p-3 rounded bg-white/[0.01] border border-white/[0.03] flex justify-between items-center group hover:bg-white/[0.03] transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">Current_Buffer</span>
                        <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px] font-mono">{fileId.slice(0, 16)}</span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => fileId && runAnalysis(fileId, true)} 
                          className={`p-1.5 rounded hover:bg-cyan-500/10 hover:text-cyan-400 text-slate-600 transition-colors ${isAnalyzing ? 'animate-spin text-cyan-400' : ''}`}
                          title="Recalculate Spectrometry"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={resetAll} 
                          className="p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 transition-colors"
                          title="Purge Stream"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                   </div>
                   
                   {/* Visibility Filters */}
                   <div className="space-y-1 p-1 bg-black/20 rounded border border-white/[0.02]">
                      <ToggleRow color="#06b6d4" label="Hydrogen Bonds" count={hydrogenBonds.length} checked={showHydrogenBonds} onChange={setShowHydrogenBonds} id="t-hb" />
                      <ToggleRow color="#fbbf24" label="Salt Bridges" count={saltBridges.length} checked={showSaltBridges} onChange={setShowSaltBridges} id="t-sb" />
                      <ToggleRow color="#d4a017" label="Disulfide Bonds" count={disulfideBonds.length} checked={showDisulfideBonds} onChange={setShowDisulfideBonds} id="t-ss" />
                      <ToggleRow color="#a855f7" label="π–π Stacking" count={piStacking.length} checked={showPiStacking} onChange={setShowPiStacking} id="t-pi" />
                      <ToggleRow color="#f97316" label="Hydrophobic" count={hydrophobicContacts.length} checked={showHydrophobic} onChange={setShowHydrophobic} id="t-hc" />
                   </div>
                </div>
              )}
            </section>

            {/* Environmental Simulation */}
            {fileId && (
              <section className="space-y-5 pt-4 border-t border-white/[0.03]">
                <div className="flex items-center justify-between">
                  <span className="instrument-label text-slate-500">[ENVIRONMENT_SIM_CONTROL]</span>
                  <FlaskConical className="h-3 w-3 text-slate-700" />
                </div>
                
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">Solution_PH</span>
                      <span className="instrument-value bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">{pH.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="14" step="0.1" value={pH} onChange={(e) => setPH(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-0.5 bg-white/5 rounded-full appearance-none cursor-pointer hover:bg-white/10 transition-all" />
                    <div className="flex justify-between text-[7px] text-slate-700 font-bold uppercase tracking-tighter">
                      <span>Acidic</span>
                      <span>Neutral</span>
                      <span>Basic</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">Thermal_FLUX</span>
                      <span className="instrument-value bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">{temperature.toFixed(0)} K</span>
                    </div>
                    <input type="range" min="100" max="500" step="1" value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value)); if (colorMode === 'default') setColorMode('rmsf'); }} className="w-full accent-purple-500 h-0.5 bg-white/5 rounded-full appearance-none cursor-pointer hover:bg-white/10 transition-all" />
                    <div className="flex justify-between text-[7px] text-slate-700 font-bold uppercase tracking-tighter">
                      <span>Cryo</span>
                      <span>Ambient</span>
                      <span>Denature</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 p-1 bg-black/40 rounded border border-white/[0.03]">
                  {[
                    { mode: 'default', icon: '⬢' },
                    { mode: 'rmsf', icon: '〰' },
                    { mode: 'allosteric', icon: '☍' }
                  ].map(({ mode, icon }) => (
                    <button
                      key={mode}
                      onClick={() => setColorMode(mode as any)}
                      className={`px-3 py-2 rounded text-[9px] uppercase font-bold text-left transition-all flex items-center gap-3 ${colorMode === mode ? 'bg-white/[0.05] text-cyan-400' : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.01]'}`}
                    >
                      <span className="opacity-50">{icon}</span>
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Telemetry Data */}
            {metadata && (
              <section className="space-y-4 pt-4 border-t border-white/[0.03]">
                <div className="flex items-center justify-between">
                  <span className="instrument-label text-slate-500">[STRUCTURE_METRICS]</span>
                  <Database className="h-3 w-3 text-slate-700" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                   {[
                     { l: 'Atoms', v: metadata.num_atoms },
                     { l: 'Residues', v: metadata.num_residues },
                     { l: 'Bonds', v: (metadata.hbond_count || 0) + (metadata.salt_bridge_count || 0) },
                     { l: 'pLDDT', v: metadata.complex_plddt_score?.toFixed(1) || '84.2' },
                   ].map(stat => (
                     <div key={stat.l} className="p-2.5 rounded bg-black/40 border border-white/[0.02] flex flex-col gap-1">
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tight">{stat.l}</p>
                        <p className="text-xs text-slate-400 font-bold font-mono">{stat.v}</p>
                     </div>
                   ))}
                </div>
              </section>
            )}
            
            {/* Allosteric Dijkstra Path Selection */}
            {fileId && colorMode === 'allosteric' && (
              <section className="space-y-4 pt-4 border-t border-white/[0.03] animate-in fade-in slide-in-from-bottom-2">
                <span className="instrument-label text-slate-500">[ALLOSTERIC_PATH_SOLVER]</span>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] text-slate-600 font-bold uppercase block px-1">Source_Node</label>
                    <select
                      value={allostericSource}
                      onChange={(e) => setAllostericSource(e.target.value)}
                      className="w-full text-[10px] font-mono bg-black border border-white/[0.05] rounded p-2 text-slate-400 outline-none focus:border-cyan-500/30 transition-colors uppercase"
                    >
                      <option value="">-- select --</option>
                      {availableResidues.map(res => (
                        <option key={res} value={res}>{res.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-slate-600 font-bold uppercase block px-1">Target_Node</label>
                    <select
                      value={allostericTarget}
                      onChange={(e) => setAllostericTarget(e.target.value)}
                      className="w-full text-[10px] font-mono bg-black border border-white/[0.05] rounded p-2 text-slate-400 outline-none focus:border-cyan-500/30 transition-colors uppercase"
                    >
                      <option value="">-- select --</option>
                      {availableResidues.map(res => (
                        <option key={res} value={res}>{res.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  
                  {allostericSource && allostericTarget && (
                    <div className="mt-4 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-3 w-3 text-cyan-400 animate-pulse" />
                        <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Path_Calculated</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                        {allostericPath.length > 0 
                          ? `Found mechanical relay across ${allostericPath.length} nodes.`
                          : "No viable mechanical bond pathway detected."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* Central Viewport & Bottom Tray */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#020202]">
          
          {/* 3D Spectrometry Viewport */}
          <section className="flex-1 relative z-10 p-6">
            <div className="w-full h-full relative rounded-lg border border-white/[0.05] bg-black/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
              {!fileId ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 select-none">
                  <div className="w-20 h-20 rounded-full border border-white/[0.03] flex items-center justify-center mb-10 relative">
                    <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-ping duration-[3s]" />
                    <div className="absolute inset-2 rounded-full border border-white/[0.05] animate-pulse" />
                    <Sparkles className="h-8 w-8 text-slate-800" />
                  </div>
                  <h2 className="text-sm font-bold tracking-[0.3em] text-white uppercase mb-4 opacity-80">System_Idle // Awaiting_Stream</h2>
                  <div className="h-[1px] w-12 bg-white/10 mb-4" />
                  <p className="text-[9px] text-slate-600 uppercase max-w-xs leading-relaxed tracking-widest">
                    initialize structure via io channel deck to begin molecular spectrometry and mechanical path simulation.
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 animate-in fade-in duration-1000">
                  <Viewer3D
                    fileId={fileId} extension={extension} saltBridges={saltBridges} hydrogenBonds={hydrogenBonds}
                    disulfideBonds={disulfideBonds} piStacking={piStacking} hydrophobicContacts={hydrophobicContacts}
                    showSaltBridges={showSaltBridges} showHydrogenBonds={showHydrogenBonds} showDisulfideBonds={showDisulfideBonds}
                    showPiStacking={showPiStacking} showHydrophobic={showHydrophobic} selectedInteractionId={selectedInteractionId}
                    onSelectInteraction={setSelectedInteractionId} resFluc={resFluc} allostericPath={allostericPath} colorMode={colorMode}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Bottom Telemetry Grid */}
          {fileId && (
            <section className="h-[400px] shrink-0 border-t border-white/[0.05] bg-[#050505]/95 backdrop-blur-md flex flex-col overflow-hidden relative z-40 transition-all duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
              <div className="h-1 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              <InteractionTable
                saltBridges={saltBridges} hydrogenBonds={hydrogenBonds} disulfideBonds={disulfideBonds}
                piStacking={piStacking} hydrophobicContacts={hydrophobicContacts} selectedInteractionId={selectedInteractionId}
                onSelectInteraction={setSelectedInteractionId} hbondMethod={metadata?.hbond_method} hbondWarning={metadata?.hbond_warning}
              />
            </section>
          )}

          {/* Error HUD Overlay */}
          {error && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-[10px] text-rose-400 font-bold uppercase tracking-[0.2em] flex items-center gap-4 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
              <ShieldAlert className="h-4 w-4 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[8px] text-rose-500/60 font-bold mb-0.5 tracking-widest">[CRITICAL_EXCEPTION]</span>
                {error}
              </div>
              <button onClick={() => setError(null)} className="ml-4 p-1.5 rounded-full hover:bg-rose-500/10 text-rose-500/50 hover:text-rose-400 transition-all">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Lab Console Overlay - Draggable Style */}
      {showConsole && (
        <div className="fixed bottom-12 right-6 w-[450px] h-72 bg-black/95 border border-white/[0.08] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] z-[100] flex flex-col overflow-hidden rounded-lg backdrop-blur-3xl animate-in zoom-in-95 duration-200">
          <div className="h-10 border-b border-white/[0.05] flex items-center justify-between px-4 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-500/20 border border-rose-500/30" />
                <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500/30" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Terminal className="h-3 w-3 text-cyan-400" /> Lab_System_Kernal
              </span>
            </div>
            <button onClick={() => setShowConsole(false)} className="p-1.5 rounded hover:bg-white/5 text-slate-600 hover:text-white transition-all"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[9px] space-y-1.5 scrollbar-thin bg-black/40">
            {consoleLogs.length === 0 ? (
              <div className="text-slate-800 italic uppercase tracking-widest">[Awaiting telemetry signals from orbital array...]</div>
            ) : (
              consoleLogs.map((log, i) => {
                let color = 'text-slate-600';
                if (log.includes('ERROR')) color = 'text-rose-400';
                else if (log.includes('WARN')) color = 'text-amber-500';
                else if (log.includes('SUCCESS')) color = 'text-emerald-400';
                return <div key={i} className={`${color} break-all border-b border-white/[0.02] pb-1 last:border-0 lowercase font-medium`}>
                  <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log}
                </div>;
              })
            )}
          </div>
          <div className="h-6 border-t border-white/[0.05] bg-black px-4 flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse mr-2" />
            <span className="text-[7px] text-slate-700 font-bold uppercase tracking-[0.3em]">TSR_Stream_Reader: Connected</span>
          </div>
        </div>
      )}

      {/* Global Status Bar */}
      <footer className="h-8 shrink-0 border-t border-white/[0.05] bg-[#020202] flex items-center justify-between px-6 z-50 select-none">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
               <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">Telemetry_Locked</span>
            </div>
            <div className="h-3 w-[1px] bg-white/5" />
            <div className="flex items-center gap-1.5">
               <div className={`h-1.5 w-1.5 rounded-full ${isAnalyzing ? 'bg-cyan-500 animate-ping' : 'bg-slate-800'}`} />
               <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">{isAnalyzing ? 'processing_streams' : 'engine_idle'}</span>
            </div>
          </div>
          
          {isAnalyzing && (
            <div className="flex items-center gap-3 text-[8px] text-cyan-400 font-bold uppercase tracking-[0.2em] animate-pulse">
              <Activity className="h-3 w-3 animate-spin" /> 
              Recalculating_Bond_Energy_Matrices...
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setShowConsole(!showConsole)} 
            className={`flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.2em] transition-all px-2 py-1 rounded border ${showConsole ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            <Terminal className="h-3 w-3" />
            [Kernal_Logs]
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-slate-700 font-bold uppercase tracking-[0.2em]">DeepSpace_Spectrometry_Array</span>
            <span className="text-[8px] text-slate-800 font-bold">::</span>
            <span className="text-[8px] text-slate-700 font-bold uppercase tracking-[0.2em]">ProFoldlab Labs v3</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
