import { useState } from 'react';
import { SaltBridge, HydrogenBond, DisulfideBond, PiStack, HydrophobicContact } from '../utils/api';
import { Activity, ShieldAlert, Search } from 'lucide-react';

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
  saltBridges: SaltBridge[];
  hydrogenBonds: HydrogenBond[];
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
    <div className="flex items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
        {chain}:{name}{number}
      </span>
      <span className="font-bold text-[11px]" style={{ color }}>{name}</span>
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

  const q = searchQuery.toLowerCase();

  const filteredHBonds = hydrogenBonds.filter(hb =>
    !q || [hb.donor_residue.name, hb.donor_residue.number.toString(),
            hb.acceptor_residue.name, hb.acceptor_residue.number.toString(),
            hb.donor_atom.name, hb.acceptor_atom.name].some(v => v.toLowerCase().includes(q))
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

  const tabs: TabDef[] = [
    { id: 'hbonds',       label: 'H-Bonds',     count: hydrogenBonds.length,     color: '#06b6d4', activeBg: 'bg-cyan-500/15',    activeBorder: 'border-cyan-500/30'    },
    { id: 'saltbridges',  label: 'Salt Bridges', count: saltBridges.length,       color: '#fbbf24', activeBg: 'bg-amber-500/15',   activeBorder: 'border-amber-500/30'   },
    { id: 'disulfide',    label: 'S–S Bonds',    count: disulfideBonds.length,    color: '#d4a017', activeBg: 'bg-yellow-700/20',  activeBorder: 'border-yellow-700/30'  },
    { id: 'pistacking',   label: 'π–π Stack',    count: piStacking.length,        color: '#a855f7', activeBg: 'bg-purple-500/15',  activeBorder: 'border-purple-500/30'  },
    { id: 'hydrophobic',  label: 'Hydrophobic',  count: hydrophobicContacts.length, color: '#f97316', activeBg: 'bg-orange-500/15', activeBorder: 'border-orange-500/30' },
  ];

  const rowBase = 'cursor-pointer transition-colors';

  return (
    <div className="w-full flex flex-col bg-slate-900/35 border border-slate-800 rounded-2xl overflow-hidden glass-panel">

      {/* Tabs + Search header */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-slate-950/30">
        {/* Scrollable tab row */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                id={`tab-btn-${tab.id}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all border ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeBorder}`
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
                style={isActive ? { color: tab.color } : undefined}
              >
                {tab.label}
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by residue name or number…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 outline-none transition"
            id="interaction-table-search-input"
          />
        </div>
      </div>

      {/* H-bond method/warning subheader */}
      {activeTab === 'hbonds' && (hbondWarning || hbondMethod) && (
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-cyan-400" />
            Detection Engine: <span className="text-slate-200 font-medium">{hbondMethod}</span>
          </span>
          {hbondWarning && (
            <span className="text-amber-400 flex items-center gap-1 font-medium animate-pulse">
              <ShieldAlert className="h-3 w-3" />
              {hbondWarning}
            </span>
          )}
        </div>
      )}

      {/* Table body */}
      <div className="flex-1 overflow-y-auto max-h-[380px]">

        {/* ── Hydrogen Bonds ── */}
        {activeTab === 'hbonds' && (
          filteredHBonds.length === 0
            ? <EmptyState label="Hydrogen Bonds" />
            : <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80 select-none">
                  <th className="p-3 pl-4">Donor</th>
                  <th className="p-3">Acceptor</th>
                  <th className="p-3 text-right">Dist (Å)</th>
                  <th className="p-3 text-right">Angle</th>
                  <th className="p-3 text-right">Energy (kJ/mol)</th>
                  <th className="p-3 text-center">Strength</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredHBonds.map(hb => (
                    <tr key={hb.id} onClick={() => onSelectInteraction(selectedInteractionId === hb.id ? null : hb.id)}
                      className={`${rowBase} ${selectedInteractionId === hb.id ? 'bg-cyan-500/10 text-cyan-300 font-medium' : 'hover:bg-slate-900/50 text-slate-300'}`}>
                      <td className="p-3 pl-4">
                        <ResidueChip chain={hb.donor_residue.chain} name={hb.donor_residue.name} number={hb.donor_residue.number} color="#06b6d4" />
                        <span className="text-[10px] text-slate-500 ml-1">{hb.donor_atom.name}</span>
                      </td>
                      <td className="p-3">
                        <ResidueChip chain={hb.acceptor_residue.chain} name={hb.acceptor_residue.name} number={hb.acceptor_residue.number} color="#f472b6" />
                        <span className="text-[10px] text-slate-500 ml-1">{hb.acceptor_atom.name}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-400 font-bold">{hb.distance.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-slate-400">{hb.angle ? `${hb.angle.toFixed(1)}°` : '—'}</td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{hb.energy_kj_mol != null ? hb.energy_kj_mol.toFixed(1) : '—'}</td>
                      <td className="p-3 text-center">
                        <StrengthBadge strength={hb.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {/* ── Salt Bridges ── */}
        {activeTab === 'saltbridges' && (
          filteredSaltBridges.length === 0
            ? <EmptyState label="Salt Bridges" hint="Requires basic (LYS, ARG) and acidic (ASP, GLU) residues within 4.0 Å" />
            : <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80 select-none">
                  <th className="p-3 pl-4">Positive (LYS/ARG)</th>
                  <th className="p-3">Negative (ASP/GLU)</th>
                  <th className="p-3 text-right">Dist (Å)</th>
                  <th className="p-3 text-right">Energy (kJ/mol)</th>
                  <th className="p-3 text-center">Strength</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredSaltBridges.map(sb => (
                    <tr key={sb.id} onClick={() => onSelectInteraction(selectedInteractionId === sb.id ? null : sb.id)}
                      className={`${rowBase} ${selectedInteractionId === sb.id ? 'bg-amber-500/10 text-amber-300 font-medium' : 'hover:bg-slate-900/50 text-slate-300'}`}>
                      <td className="p-3 pl-4">
                        <ResidueChip chain={sb.positive_residue.chain} name={sb.positive_residue.name} number={sb.positive_residue.number} color="#fbbf24" />
                        <span className="text-[10px] text-slate-500 ml-1">{sb.positive_atom.name}</span>
                      </td>
                      <td className="p-3">
                        <ResidueChip chain={sb.negative_residue.chain} name={sb.negative_residue.name} number={sb.negative_residue.number} color="#f87171" />
                        <span className="text-[10px] text-slate-500 ml-1">{sb.negative_atom.name}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-amber-400 font-bold">{sb.distance.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{sb.energy_kj_mol != null ? sb.energy_kj_mol.toFixed(1) : '—'}</td>
                      <td className="p-3 text-center">
                        <StrengthBadge strength={sb.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {/* ── Disulfide Bonds ── */}
        {activeTab === 'disulfide' && (
          filteredDisulfide.length === 0
            ? <EmptyState label="Disulfide Bonds" hint="Requires two CYS residues with SG–SG distance < 2.5 Å" />
            : <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80 select-none">
                  <th className="p-3 pl-4">CYS A</th>
                  <th className="p-3">CYS B</th>
                  <th className="p-3 text-right">S–S Dist (Å)</th>
                  <th className="p-3 text-right">Energy (kJ/mol)</th>
                  <th className="p-3 text-center">Strength</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredDisulfide.map(ss => (
                    <tr key={ss.id} onClick={() => onSelectInteraction(selectedInteractionId === ss.id ? null : ss.id)}
                      className={`${rowBase} ${selectedInteractionId === ss.id ? 'bg-yellow-700/20 text-yellow-300 font-medium' : 'hover:bg-slate-900/50 text-slate-300'}`}>
                      <td className="p-3 pl-4"><ResidueChip chain={ss.residue_a.chain} name={ss.residue_a.name} number={ss.residue_a.number} color="#d4a017" /></td>
                      <td className="p-3"><ResidueChip chain={ss.residue_b.chain} name={ss.residue_b.name} number={ss.residue_b.number} color="#d4a017" /></td>
                      <td className="p-3 text-right font-mono font-bold" style={{ color: '#d4a017' }}>{ss.distance.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{ss.energy_kj_mol != null ? ss.energy_kj_mol.toFixed(1) : '—'}</td>
                      <td className="p-3 text-center">
                        <StrengthBadge strength={ss.strength || 'covalent'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {/* ── Pi-Pi Stacking ── */}
        {activeTab === 'pistacking' && (
          filteredPiStack.length === 0
            ? <EmptyState label="π–π Stacking" hint="Requires aromatic residues (PHE, TYR, TRP, HIS) with ring centroid distance < 5.5 Å" />
            : <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80 select-none">
                  <th className="p-3 pl-4">Ring A</th>
                  <th className="p-3">Ring B</th>
                  <th className="p-3 text-right">Dist (Å)</th>
                  <th className="p-3 text-right">Angle</th>
                  <th className="p-3 text-right">Type</th>
                  <th className="p-3 text-right">Energy (kJ/mol)</th>
                  <th className="p-3 text-center">Strength</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredPiStack.map(pi => (
                    <tr key={pi.id} onClick={() => onSelectInteraction(selectedInteractionId === pi.id ? null : pi.id)}
                      className={`${rowBase} ${selectedInteractionId === pi.id ? 'bg-purple-500/10 text-purple-300 font-medium' : 'hover:bg-slate-900/50 text-slate-300'}`}>
                      <td className="p-3 pl-4"><ResidueChip chain={pi.residue_a.chain} name={pi.residue_a.name} number={pi.residue_a.number} color="#a855f7" /></td>
                      <td className="p-3"><ResidueChip chain={pi.residue_b.chain} name={pi.residue_b.name} number={pi.residue_b.number} color="#a855f7" /></td>
                      <td className="p-3 text-right font-mono text-purple-400 font-bold">{pi.distance.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-slate-400">{pi.angle.toFixed(1)}°</td>
                      <td className="p-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${pi.stack_type === 'parallel' ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                          {pi.stack_type === 'parallel' ? '∥ parallel' : '⊥ T-shaped'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{pi.energy_kj_mol != null ? pi.energy_kj_mol.toFixed(1) : '—'}</td>
                      <td className="p-3 text-center">
                        <StrengthBadge strength={pi.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {/* ── Hydrophobic Contacts ── */}
        {activeTab === 'hydrophobic' && (
          filteredHydrophobic.length === 0
            ? <EmptyState label="Hydrophobic Contacts" hint="Requires non-polar residues (ALA,VAL,ILE,LEU,MET,PHE,TRP,PRO) with Cβ–Cβ < 5.5 Å" />
            : <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80 select-none">
                  <th className="p-3 pl-4">Residue A</th>
                  <th className="p-3">Residue B</th>
                  <th className="p-3 text-right">Cβ–Cβ (Å)</th>
                  <th className="p-3 text-right">Energy (kJ/mol)</th>
                  <th className="p-3 text-center">Strength</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredHydrophobic.map(hc => (
                    <tr key={hc.id} onClick={() => onSelectInteraction(selectedInteractionId === hc.id ? null : hc.id)}
                      className={`${rowBase} ${selectedInteractionId === hc.id ? 'bg-orange-500/10 text-orange-300 font-medium' : 'hover:bg-slate-900/50 text-slate-300'}`}>
                      <td className="p-3 pl-4"><ResidueChip chain={hc.residue_a.chain} name={hc.residue_a.name} number={hc.residue_a.number} color="#f97316" /></td>
                      <td className="p-3"><ResidueChip chain={hc.residue_b.chain} name={hc.residue_b.name} number={hc.residue_b.number} color="#f97316" /></td>
                      <td className="p-3 text-right font-mono font-bold text-orange-400">{hc.distance.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{hc.energy_kj_mol != null ? hc.energy_kj_mol.toFixed(1) : '—'}</td>
                      <td className="p-3 text-center">
                        <StrengthBadge strength={hc.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between select-none">
        <span>Click any row to focus the 3D camera on that interaction.</span>
        {selectedInteractionId && (
          <button onClick={() => onSelectInteraction(null)} className="text-cyan-400 hover:underline font-semibold" id="clear-selection-btn">
            Clear Selection
          </button>
        )}
      </div>
    </div>
  );
}

function StrengthBadge({ strength }: { strength?: string }) {
  if (!strength) return <span className="text-slate-500">—</span>;
  const classes: Record<string, string> = {
    covalent: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    strong: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    moderate: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    weak: 'bg-slate-500/25 text-slate-400 border border-slate-500/15',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${classes[strength] || classes.weak}`}>
      {strength}
    </span>
  );
}

function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-2">
      <p className="text-sm font-medium">No {label} detected</p>
      {hint && <p className="text-xs max-w-sm">{hint}</p>}
    </div>
  );
}
