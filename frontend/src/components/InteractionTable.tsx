import { useState, useEffect, useRef } from 'react';
import { SaltBridge, HydrogenBond, DisulfideBond, PiStack, HydrophobicContact } from '../utils/api';
import { Activity, ShieldAlert, Search, Terminal, ChevronRight } from 'lucide-react';

type TabId = 'hbonds' | 'saltbridges' | 'disulfide' | 'pistacking' | 'hydrophobic';

interface TabDef {
  id: TabId;
  label: string;
  count: number;
  color: string;
  activeBg: string;
  activeBorder: string;
}

interface InteractionTableProps {
  saltBridges: (SaltBridge & { snapped?: boolean })[];
  hydrogenBonds: (HydrogenBond & { snapped?: boolean })[];
  disulfideBonds: DisulfideBond[];
  piStacking: PiStack[];
  hydrophobicContacts: HydrophobicContact[];
  selectedInteractionId: string | null;
  onSelectInteraction: (id: string | null) => void;
  hbondMethod?: string;
  hbondWarning?: string | null;
}

function ResidueChip({ chain, name, number, color }: { chain: string; name: string; number: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono select-none">
      <span className="px-1 py-0.5 rounded bg-white/[0.03] text-[8px] text-slate-500 border border-white/[0.05] font-bold tracking-tighter">
        {chain}:{number}
      </span>
      <span className="font-bold text-[10px] uppercase tracking-tight" style={{ color }}>{name}</span>
    </div>
  );
}

export default function InteractionTable({
  saltBridges,
  hydrogenBonds,
  disulfideBonds,
  piStacking,
  hydrophobicContacts,
  selectedInteractionId,
  onSelectInteraction,
  hbondMethod,
  hbondWarning,
}: InteractionTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>('hbonds');
  const [searchQuery, setSearchQuery] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  const q = searchQuery.toLowerCase();

  const filteredHBonds = hydrogenBonds.filter(hb =>
    !q || [hb.donor_residue.name, hb.donor_residue.number.toString(),
            hb.acceptor_residue.name, hb.acceptor_residue.number.toString()].some(v => v.toLowerCase().includes(q))
  );

  const filteredSaltBridges = saltBridges.filter(sb =>
    !q || [sb.positive_residue.name, sb.positive_residue.number.toString(),
            sb.negative_residue.name, sb.negative_residue.number.toString()].some(v => v.toLowerCase().includes(q))
  );

  const filteredDisulfide = disulfideBonds.filter(ss =>
    !q || [ss.residue_a.name, ss.residue_a.number.toString(),
            ss.residue_b.name, ss.residue_b.number.toString()].some(v => v.toLowerCase().includes(q))
  );

  const filteredPiStack = piStacking.filter(pi =>
    !q || [pi.residue_a.name, pi.residue_a.number.toString(),
            pi.residue_b.name, pi.residue_b.number.toString(), pi.stack_type].some(v => v.toLowerCase().includes(q))
  );

  const filteredHydrophobic = hydrophobicContacts.filter(hc =>
    !q || [hc.residue_a.name, hc.residue_a.number.toString(),
            hc.residue_b.name, hc.residue_b.number.toString()].some(v => v.toLowerCase().includes(q))
  );

  // Synchronize active tab and clear search when an interaction is selected externally
  useEffect(() => {
    if (!selectedInteractionId) return;
    
    let targetTab: TabId | null = null;
    let isVisible = false;

    if (hydrogenBonds.some(x => x.id === selectedInteractionId)) {
      targetTab = 'hbonds';
      isVisible = filteredHBonds.some(x => x.id === selectedInteractionId);
    } else if (saltBridges.some(x => x.id === selectedInteractionId)) {
      targetTab = 'saltbridges';
      isVisible = filteredSaltBridges.some(x => x.id === selectedInteractionId);
    } else if (disulfideBonds.some(x => x.id === selectedInteractionId)) {
      targetTab = 'disulfide';
      isVisible = filteredDisulfide.some(x => x.id === selectedInteractionId);
    } else if (piStacking.some(x => x.id === selectedInteractionId)) {
      targetTab = 'pistacking';
      isVisible = filteredPiStack.some(x => x.id === selectedInteractionId);
    } else if (hydrophobicContacts.some(x => x.id === selectedInteractionId)) {
      targetTab = 'hydrophobic';
      isVisible = filteredHydrophobic.some(x => x.id === selectedInteractionId);
    }

    if (targetTab) {
      setActiveTab(targetTab);
      // If the selected item is filtered out by search, clear the search to make it visible
      if (!isVisible) {
        setSearchQuery('');
      }
    }

    // Trigger flash effect
    setFlashId(selectedInteractionId);
    const timer = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(timer);
  }, [selectedInteractionId, hydrogenBonds, saltBridges, disulfideBonds, piStacking, hydrophobicContacts]);

  // Auto-scroll to selected row
  useEffect(() => {
    if (selectedInteractionId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedInteractionId, activeTab]);

  const tabs: TabDef[] = [
    { id: 'hbonds',       label: 'H-BONDS',     count: hydrogenBonds.length,     color: '#06b6d4', activeBg: 'bg-cyan-500/5',    activeBorder: 'border-cyan-500/20' },
    { id: 'saltbridges',  label: 'SALT_BRIDGES', count: saltBridges.length,       color: '#fbbf24', activeBg: 'bg-amber-500/5',   activeBorder: 'border-amber-500/20' },
    { id: 'disulfide',    label: 'COVALENT_SS',  count: disulfideBonds.length,    color: '#d4a017', activeBg: 'bg-yellow-500/5',  activeBorder: 'border-yellow-500/20' },
    { id: 'pistacking',   label: 'PI_STACK',     count: piStacking.length,        color: '#a855f7', activeBg: 'bg-purple-500/5',  activeBorder: 'border-purple-500/20' },
    { id: 'hydrophobic',  label: 'HYDROPHOBIC',  count: hydrophobicContacts.length, color: '#f97316', activeBg: 'bg-orange-500/5', activeBorder: 'border-orange-500/20' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-transparent font-mono">

      {/* Controller Header */}
      <div className="shrink-0 p-4 border-b border-white/[0.03] flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <Terminal className="h-3 w-3 text-slate-700" />
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">[TELEMETRY_LOG_DECK]</span>
           </div>
           
           <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded text-[9px] font-bold transition-all border flex items-center gap-2 ${
                    isActive
                      ? `${tab.activeBg} ${tab.activeBorder} text-white shadow-sm`
                      : 'text-slate-600 hover:text-slate-400 border-transparent'
                  }`}
                >
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: tab.color, opacity: isActive ? 1 : 0.3 }} />
                  {tab.label}
                  <span className="opacity-40 ml-1">({String(tab.count).padStart(2, '0')})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1.5 h-3 w-3 text-slate-700" />
          <input
            type="text"
            placeholder="FILTER_STREAM..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/[0.05] focus:border-cyan-500/20 rounded pl-8 pr-3 py-1.5 text-[10px] text-slate-400 placeholder:text-slate-800 outline-none transition uppercase"
          />
        </div>
      </div>

      {/* Engine Metadata Line */}
      {activeTab === 'hbonds' && (hbondWarning || hbondMethod) && (
        <div className="shrink-0 px-4 py-1.5 bg-black/60 border-b border-white/[0.02] flex items-center gap-4 text-[8px] font-bold text-slate-700 uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <Activity className="h-2.5 w-2.5 text-cyan-500/50" />
            ENGINE_STREAM: <span className="text-slate-500">{hbondMethod || 'MDANALYSIS_SPECTRA'}</span>
          </span>
          {hbondWarning && (
            <span className="text-amber-500/60 flex items-center gap-1">
              <ShieldAlert className="h-2.5 w-2.5" />
              {hbondWarning}
            </span>
          )}
        </div>
      )}

      {/* High-Density Data Workspace */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth select-none">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/20 text-[8px] font-bold text-slate-700 uppercase tracking-widest border-b border-white/[0.03]">
              <th className="p-2.5 pl-6">[STREAM_A]</th>
              <th className="p-2.5">[STREAM_B]</th>
              <th className="p-2.5 text-right">DIST (Å)</th>
              <th className="p-2.5 text-right">ENERGY</th>
              <th className="p-2.5 text-right">FORCE</th>
              <th className="p-2.5 text-center">STATUS</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {activeTab === 'hbonds' && filteredHBonds.map(hb => renderRow(hb, '#06b6d4', 'H-BOND', hb.donor_residue, hb.acceptor_residue, hb.distance, hb.energy_kj_mol, hb.force_pn, hb.strength))}
            {activeTab === 'saltbridges' && filteredSaltBridges.map(sb => renderRow(sb, '#fbbf24', 'SALT_BRIDGE', sb.positive_residue, sb.negative_residue, sb.distance, sb.energy_kj_mol, sb.force_pn, sb.strength))}
            {activeTab === 'disulfide' && filteredDisulfide.map(ss => renderRow(ss, '#d4a017', 'S-S_BOND', ss.residue_a, ss.residue_b, ss.distance, ss.energy_kj_mol, ss.force_pn, 'COVALENT'))}
            {activeTab === 'pistacking' && filteredPiStack.map(pi => renderRow(pi, '#a855f7', 'PI_STACK', pi.residue_a, pi.residue_b, pi.distance, pi.energy_kj_mol, pi.force_pn, pi.stack_type))}
            {activeTab === 'hydrophobic' && filteredHydrophobic.map(hc => renderRow(hc, '#f97316', 'HYDROPHOBIC', hc.residue_a, hc.residue_b, hc.distance, hc.energy_kj_mol, hc.force_pn, hc.strength))}
          </tbody>
        </table>
        
        {(activeTab === 'hbonds' ? filteredHBonds : activeTab === 'saltbridges' ? filteredSaltBridges : activeTab === 'disulfide' ? filteredDisulfide : activeTab === 'pistacking' ? filteredPiStack : filteredHydrophobic).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-20 grayscale">
            <Activity className="h-6 w-6" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">No telemetry detected in this channel</span>
          </div>
        )}
      </div>

      {/* Footer Status Log */}
      <div className="shrink-0 h-6 px-4 bg-black border-t border-white/[0.03] flex items-center justify-between text-[8px] font-bold text-slate-700 uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <div className="h-1 w-1 rounded-full bg-cyan-500 animate-pulse" />
          Stream_Reader_Synchronized :: {activeTab.toUpperCase()}
        </span>
        {selectedInteractionId && (
          <button onClick={() => onSelectInteraction(null)} className="text-cyan-500/80 hover:text-cyan-400">
            [Clear_Active_Selection]
          </button>
        )}
      </div>
    </div>
  );

  function renderRow(item: any, color: string, type: string, resA: any, resB: any, dist: number, energy: number | null, force: number | null, status: string | undefined) {
    const isSelected = selectedInteractionId === item.id;
    const isFlashing = flashId === item.id;

    return (
      <tr
        key={item.id}
        ref={isSelected ? selectedRowRef : null}
        onClick={(e) => {
          e.stopPropagation();
          console.log(`[InteractionTable] Clicking item ID: ${item.id}`);
          onSelectInteraction(isSelected ? null : item.id);
        }}
        className={`group transition-all cursor-pointer ${
          isSelected 
            ? 'bg-cyan-500/10 text-white ring-1 ring-inset ring-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]' 
            : 'hover:bg-white/[0.01] text-slate-400'
        } ${isFlashing ? 'animate-pulse bg-cyan-500/20' : ''} ${item.snapped ? 'opacity-30 grayscale italic' : ''}`}
      >
        <td className="p-2.5 pl-6">
          <div className="flex items-center gap-3">
            <div className={`w-0.5 h-3 rounded-full transition-all ${isSelected ? 'opacity-100 scale-y-125' : 'opacity-0'}`} style={{ backgroundColor: color }} />
            <ResidueChip chain={resA.chain} name={resA.name} number={resA.number} color={color} />
          </div>
        </td>
        <td className="p-2.5">
          <ResidueChip chain={resB.chain} name={resB.name} number={resB.number} color={color} />
        </td>
        <td className={`p-2.5 text-right font-bold text-[10px] ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>{dist.toFixed(3)}</td>
        <td className="p-2.5 text-right text-[10px] text-emerald-500/60 font-medium">{energy != null ? `${energy.toFixed(1)}J` : '—'}</td>
        <td className="p-2.5 text-right text-[10px] text-slate-600">{force != null ? `${force.toFixed(0)}pN` : '—'}</td>
        <td className="p-2.5 text-center">
           <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold border ${
             isSelected ? 'bg-white/5 border-white/10 text-white' : 'bg-transparent border-white/[0.03] text-slate-700'
           }`}>
             {item.snapped ? 'SNAPPED' : (status || type).toUpperCase()}
           </span>
        </td>
        <td className="p-2.5 text-center">
           <ChevronRight className={`h-3 w-3 transition-all ${isSelected ? 'translate-x-0 opacity-100 text-cyan-500' : '-translate-x-2 opacity-0'}`} />
        </td>
      </tr>
    );
  }
}
