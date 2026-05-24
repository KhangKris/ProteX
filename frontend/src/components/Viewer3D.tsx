import { useEffect, useRef, useState, MutableRefObject } from 'react';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { Shape, ShapeGroup } from 'molstar/lib/mol-model/shape';
import { MeshBuilder } from 'molstar/lib/mol-geo/geometry/mesh/mesh-builder';
import { addCylinder } from 'molstar/lib/mol-geo/geometry/mesh/builder/cylinder';

import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Color } from 'molstar/lib/mol-util/color';
import { ShapeRepresentation3D } from 'molstar/lib/mol-plugin-state/transforms/representation';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh';
import { PluginStateObject as SO } from 'molstar/lib/mol-plugin-state/objects';
import { StateTransformer } from 'molstar/lib/mol-state';
import { Sphere3D } from 'molstar/lib/mol-math/geometry';
import { Loci } from 'molstar/lib/mol-model/loci';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Script } from 'molstar/lib/mol-script/script';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { setStructureOverpaint, clearStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint';

import 'molstar/build/viewer/molstar.css';
import { X, Activity, Target } from 'lucide-react';

import { HydrogenBond, SaltBridge, DisulfideBond, PiStack, HydrophobicContact, getFileUrl } from '../utils/api';

// Define the custom CreateShape transformer
let CreateShape: StateTransformer<SO.Root, SO.Shape.Provider, { shape: Shape, label: string }>;
try {
  CreateShape = StateTransformer.get('custom-shape-namespace.create-shape');
} catch (e) {
  CreateShape = StateTransformer.create<SO.Root, SO.Shape.Provider, { shape: Shape, label: string }>('custom-shape-namespace', {
    name: 'create-shape',
    from: [SO.Root],
    to: [SO.Shape.Provider],
    display: { name: 'Create Shape' },
    apply({ params }) {
      return new SO.Shape.Provider({
        label: params.label,
        data: params.shape,
        params: Mesh.Params,
        getShape: () => params.shape,
        geometryUtils: Mesh.Utils
      }, { label: params.label });
    }
  });
}

let nodeCounter = 0;

interface Viewer3DProps {
  fileId: string | null;
  extension: string | null;
  saltBridges: SaltBridge[];
  hydrogenBonds: HydrogenBond[];
  disulfideBonds: DisulfideBond[];
  piStacking: PiStack[];
  hydrophobicContacts: HydrophobicContact[];
  showSaltBridges: boolean;
  showHydrogenBonds: boolean;
  showDisulfideBonds: boolean;
  showPiStacking: boolean;
  showHydrophobic: boolean;
  selectedInteractionId: string | null;
  onSelectInteraction: (id: string | null) => void;
  resFluc?: Record<string, number>;
  allostericPath?: string[];
  colorMode?: 'default' | 'rmsf' | 'allosteric';
}

export default function Viewer3D({
  fileId,
  extension,
  saltBridges,
  hydrogenBonds,
  disulfideBonds,
  piStacking,
  hydrophobicContacts,
  showSaltBridges,
  showHydrogenBonds,
  showDisulfideBonds,
  showPiStacking,
  showHydrophobic,
  selectedInteractionId,
  onSelectInteraction,
  resFluc,
  allostericPath,
  colorMode = 'default',
}: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isStructureLoaded, setIsStructureLoaded] = useState(false);

  // Helper to log errors safely
  const safeError = (label: string, err: any) => {
    const msg = typeof err === 'string' ? err : err?.message || '';
    if (msg.includes('renderObject') || msg.includes('expected renderObject')) return; // Silenced per user request
    console.error(`[Viewer3D] ${label}:`, err);
  };

  // Find selected interaction details
  const getSelectedInteractionDetails = () => {
    if (!selectedInteractionId) return null;
    
    const hb = hydrogenBonds.find(x => x.id === selectedInteractionId);
    if (hb) {
      return {
        type: 'Hydrogen Bond',
        color: '#06b6d4',
        accentBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
        resA: `${hb.donor_residue.chain}:${hb.donor_residue.name}${hb.donor_residue.number}`,
        atomA: hb.donor_atom.name,
        resB: `${hb.acceptor_residue.chain}:${hb.acceptor_residue.name}${hb.acceptor_residue.number}`,
        atomB: hb.acceptor_atom.name,
        distance: hb.distance,
        energy: hb.energy_kj_mol,
        force: hb.force_pn,
        extra: hb.angle ? `Angle: ${hb.angle.toFixed(1)}°` : null,
      };
    }

    const sb = saltBridges.find(x => x.id === selectedInteractionId);
    if (sb) {
      return {
        type: 'Salt Bridge',
        color: '#fbbf24',
        accentBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        resA: `${sb.positive_residue.chain}:${sb.positive_residue.name}${sb.positive_residue.number}`,
        atomA: sb.positive_atom.name,
        resB: `${sb.negative_residue.chain}:${sb.negative_residue.name}${sb.negative_residue.number}`,
        atomB: sb.negative_atom.name,
        distance: sb.distance,
        energy: sb.energy_kj_mol,
        force: sb.force_pn,
        extra: 'Electrostatic',
      };
    }

    const ss = disulfideBonds.find(x => x.id === selectedInteractionId);
    if (ss) {
      return {
        type: 'Disulfide Bond',
        color: '#d4a017',
        accentBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
        resA: `${ss.residue_a.chain}:${ss.residue_a.name}${ss.residue_a.number}`,
        atomA: ss.atom_a.name,
        resB: `${ss.residue_b.chain}:${ss.residue_b.name}${ss.residue_b.number}`,
        atomB: ss.atom_b.name,
        distance: ss.distance,
        energy: ss.energy_kj_mol,
        force: ss.force_pn,
        extra: 'Covalent S–S',
      };
    }

    const pi = piStacking.find(x => x.id === selectedInteractionId);
    if (pi) {
      return {
        type: 'π–π Stacking',
        color: '#a855f7',
        accentBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        resA: `${pi.residue_a.chain}:${pi.residue_a.name}${pi.residue_a.number}`,
        atomA: 'Centroid A',
        resB: `${pi.residue_b.chain}:${pi.residue_b.name}${pi.residue_b.number}`,
        atomB: 'Centroid B',
        distance: pi.distance,
        energy: pi.energy_kj_mol,
        force: pi.force_pn,
        extra: `${pi.stack_type}, ${pi.angle.toFixed(1)}°`,
      };
    }

    const hc = hydrophobicContacts.find(x => x.id === selectedInteractionId);
    if (hc) {
      return {
        type: 'Hydrophobic',
        color: '#f97316',
        accentBg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        resA: `${hc.residue_a.chain}:${hc.residue_a.name}${hc.residue_a.number}`,
        atomA: hc.atom_a.name,
        resB: `${hc.residue_b.chain}:${hc.residue_b.name}${hc.residue_b.number}`,
        atomB: hc.atom_b.name,
        distance: hc.distance,
        energy: hc.energy_kj_mol,
        force: hc.force_pn,
        extra: 'Dispersion',
      };
    }

    return null;
  };

  const selectedDetails = getSelectedInteractionDetails();
  const structureRef = useRef<any>(null);
  const shapesCellRefs = useRef<Record<string, any>>({});
  const highlightCellRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const hasPendingDrawRef = useRef(false);

  // Keep latest props in refs for event listeners
  const propsRef = useRef({
    saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts,
    showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic,
    onSelectInteraction,
    selectedInteractionId
  });

  useEffect(() => {
    propsRef.current = {
      saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts,
      showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic,
      onSelectInteraction,
      selectedInteractionId
    };
  }, [saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic, onSelectInteraction, selectedInteractionId]);

  // Initialize Mol* Plugin
  useEffect(() => {
    // Intercept console.error to filter out known noisy Mol* logs
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.join(' ');
      if (msg.includes('renderObject') || msg.includes('expected renderObject')) return;
      originalError.apply(console, args);
    };

    let pluginInstance: PluginUIContext | null = null;
    let clickSub: any = null;

    async function init() {
      if (!containerRef.current) return;
      const spec = DefaultPluginUISpec();
      spec.layout = { initial: { showControls: false, isExpanded: false } };
      spec.config = [[PluginConfig.Viewport.ShowAnimation, false], [PluginConfig.Viewport.ShowTrajectoryControls, false]];

      try {
        const p = await createPluginUI(containerRef.current, spec);
        if (p.canvas3d) {
          p.canvas3d.setProps({ renderer: { backgroundColor: Color(0x020202) } });
        }

        // Custom click handler
        clickSub = p.behaviors.interaction.click.subscribe((event) => {
          const loci = event.current.loci;
          
          if (Loci.isEmpty(loci)) return;

          // Helper to log to the UI console
          const logToUI = (msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
            if (!(window as any).__app_logs) (window as any).__app_logs = [];
            const prefix = type === 'success' ? ' [SUCCESS] ' : type === 'warn' ? ' [WARN] ' : ' [SYSTEM] ';
            (window as any).__app_logs.push(`${prefix}${msg}`);
          };

          // 1. Check if we clicked a custom interaction shape (The Bond Cylinder)
          if (ShapeGroup.isLoci(loci)) {
            const shape = loci.shape;
            const validShapes = ['Salt Bridges', 'Hydrogen Bonds', 'Disulfide Bonds', 'Pi Stacking', 'Hydrophobic Contacts'];
            
            if (validShapes.includes(shape.name)) {
              const group = OrderedSet.getAt(loci.groups[0].ids, 0);
              let list: any[] = [];
              const { saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, onSelectInteraction, selectedInteractionId } = propsRef.current;
              
              if (shape.name === 'Salt Bridges') list = saltBridges.filter(sb => !(sb as any).snapped);
              else if (shape.name === 'Hydrogen Bonds') list = hydrogenBonds.filter(hb => !(hb as any).snapped);
              else if (shape.name === 'Disulfide Bonds') list = disulfideBonds;
              else if (shape.name === 'Pi Stacking') list = piStacking;
              else if (shape.name === 'Hydrophobic Contacts') list = hydrophobicContacts;
              
              const item = list[group];
              if (item) {
                // Clear Mol* default selection to avoid "Red" residue highlight
                p.managers.interactivity.lociSelects.deselectAll();
                
                const isCurrentlySelected = selectedInteractionId === item.id;
                logToUI(`${isCurrentlySelected ? 'Purging' : 'Locking'} ${shape.name} Spectrometry Stream: ${item.id.slice(0, 12)}...`, isCurrentlySelected ? 'info' : 'success');
                onSelectInteraction(isCurrentlySelected ? null : item.id);
                // Trigger a re-draw manually for the highlight state
                requestAnimationFrame(() => {
                    if (plugin && plugin.state) {
                        plugin.state.data.build().commit();
                    }
                });
              }
              return;
            }
          } 
          
          // 2. Check if we clicked a residue in the protein structure
          if (StructureElement.Loci.is(loci)) {
            const location = StructureElement.Loci.getFirstLocation(loci);
            if (location && location.unit && location.unit.model && location.unit.model.atomicHierarchy) {
              const hierarchy = location.unit.model.atomicHierarchy;
              
              // Use derived mapping for residue lookup with full optional chaining
              const rIdx = hierarchy.derived?.residue?.index?.[location.element] ?? 
                           hierarchy.residueShare?.index?.[location.element];
              
              if (rIdx === undefined) {
                console.warn('[Viewer3D] Residue index is undefined, attempting location-based fallback.');
                // Fallback: Try identifying residue from the location object directly
                const unit = location.unit;
                const residueIndex = unit.residueIndex[location.element];
                if (residueIndex === undefined) {
                     console.warn('[Viewer3D] Residue index still undefined from unit fallback, skipping.');
                     return;
                }
              }

              const rIdxFinal = rIdx ?? location.unit.residueIndex[location.element];
              const rNumAuth = hierarchy.residues.auth_seq_id?.value(rIdxFinal);
              const rNumLabel = hierarchy.residues.label_seq_id?.value(rIdxFinal);
              
              // Safely access chain information
              const chainElementIndex = hierarchy.residueShare 
                ? hierarchy.residueShare.chain[location.element] 
                : hierarchy.derived?.residue?.chain?.[location.element];
                
              const chainId = chainElementIndex !== undefined 
                ? hierarchy.chains.auth_asym_id.value(chainElementIndex)
                : 'A';
                
              const rName = hierarchy.residues.label_comp_id?.value(rIdxFinal);
              
              console.log(`[Viewer3D] Clicked Residue: ${chainId}:${rName}${rNumAuth}`);
              
              // Normalize chain (some PDBs use ' ' or 'A')
              const normChain = chainId.trim() || 'A';
              
              // Find matching interaction involving this residue
              const { saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, onSelectInteraction, selectedInteractionId } = propsRef.current;
              
              const isMatch = (res: any) => {
                const resChain = res.chain.trim() || 'A';
                return resChain === normChain && (res.number === rNumAuth || res.number === rNumLabel);
              };

              const matches = [
                ...hydrogenBonds.filter(hb => isMatch(hb.donor_residue) || isMatch(hb.acceptor_residue)),
                ...saltBridges.filter(sb => isMatch(sb.positive_residue) || isMatch(sb.negative_residue)),
                ...disulfideBonds.filter(ss => isMatch(ss.residue_a) || isMatch(ss.residue_b)),
                ...piStacking.filter(pi => isMatch(pi.residue_a) || isMatch(pi.residue_b)),
                ...hydrophobicContacts.filter(hc => isMatch(hc.residue_a) || isMatch(hc.residue_b))
              ];

              console.log(`[Viewer3D] Residue ${normChain}:${rName}${rNumAuth} match results:`, matches);

              if (matches.length > 0) {
                // Clear Mol* default selection
                p.managers.interactivity.lociSelects.deselectAll();

                // Cycle through matches if the residue is already part of the selected interaction
                let nextIdx = 0;
                if (selectedInteractionId) {
                  const currIdx = matches.findIndex(m => m.id === selectedInteractionId);
                  if (currIdx !== -1) nextIdx = (currIdx + 1) % matches.length;
                }
                const selected = matches[nextIdx];
                console.log(`[Viewer3D] Selecting match ID: ${selected.id}`);
                logToUI(`Telemetry Lock: Residue ${normChain}:${rName}${rNumAuth} -> Binding to Stream ID: ${selected.id.slice(0, 12)}...`, 'success');
                onSelectInteraction(selected.id);
              } else {
                console.log(`[Viewer3D] No matches for residue ${normChain}:${rName}${rNumAuth}`);
                logToUI(`Spectrometry Null: No active connections detected for residue ${normChain}:${rName}${rNumAuth}.`, 'warn');
                onSelectInteraction(null);
              }
            } else {
              console.warn('[Viewer3D] Click location missing atomic hierarchy info.');
            }
          }
        });

        pluginInstance = p;
        setPlugin(p);
      } catch (err: any) {
        safeError('Mol* Init Error', err);
        setError('Failed to initialize 3D molecular viewer');
      }
    }

    setTimeout(init, 100);
    return () => {
      if (clickSub) clickSub.unsubscribe();
      if (pluginInstance) pluginInstance.dispose();
    };
  }, []);

  // Load structure file
  useEffect(() => {
    if (!plugin || !fileId) return;

    async function loadStructure() {
      setLoading(true);
      setError(null);
      setIsStructureLoaded(false);

      try {
        await plugin!.clear();
        const data = await plugin!.builders.data.download({ url: getFileUrl(fileId!) }, { state: { isGhost: true } });
        const trajectory = await plugin!.builders.structure.parseTrajectory(data, (extension === '.cif' || extension === '.mmcif') ? 'mmcif' : 'pdb');
        const preset = await plugin!.builders.structure.hierarchy.applyPreset(trajectory, 'default');
        
        if (preset && preset.structure) {
          structureRef.current = preset.structure;
        } else {
          const current = plugin!.managers.structure.hierarchy.current.structures;
          if (current.length > 0) structureRef.current = current[0].cell;
        }

        plugin!.managers.camera.reset();
        setIsStructureLoaded(true);
      } catch (err: any) {
        safeError('Structure Load Error', err);
        setError(`Failed to load structure: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    loadStructure();
  }, [plugin, fileId, retryCount]);

  // Interaction drawing
  useEffect(() => {
    if (!plugin || !isStructureLoaded) return;
    const active = { current: true };

    async function drawInteractions() {
      if (isDrawingRef.current) { hasPendingDrawRef.current = true; return; }
      isDrawingRef.current = true;
      hasPendingDrawRef.current = false;

      try {
        const update = plugin!.state.data.build();
        Object.values(shapesCellRefs.current).forEach(cell => { if (cell) update.delete(cell); });
        // We delete highlightCellRef here too to avoid conflicts
        if (highlightCellRef.current) update.delete(highlightCellRef.current);
        
        await update.commit();
        shapesCellRefs.current = {};
        highlightCellRef.current = null;

        if (!active.current) return;

        const { saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic, selectedInteractionId } = propsRef.current;

        if (showSaltBridges && saltBridges.length > 0) {
          await commitShape(active, 'Salt Bridges', saltBridges, buildSaltBridgesMesh(saltBridges, selectedInteractionId), 0xfbbf24, (g) => `Salt Bridge (${saltBridges[g].distance} Å)`, 'salt');
        }
        if (showHydrogenBonds && hydrogenBonds.length > 0) {
          await commitShape(active, 'Hydrogen Bonds', hydrogenBonds, buildHydrogenBondsMesh(hydrogenBonds, selectedInteractionId), 0x06b6d4, (g) => `H-Bond (${hydrogenBonds[g].distance} Å)`, 'hb');
        }
        if (showDisulfideBonds && disulfideBonds.length > 0) {
          await commitShape(active, 'Disulfide Bonds', disulfideBonds, buildDisulfideMesh(disulfideBonds, selectedInteractionId), 0xd4a017, (g) => `S–S Bond (${disulfideBonds[g].distance} Å)`, 'ss');
        }
        if (showPiStacking && piStacking.length > 0) {
          await commitShape(active, 'Pi Stacking', piStacking, buildPiStackMesh(piStacking, selectedInteractionId), 0xa855f7, (g) => `π–π Stack (${piStacking[g].distance} Å)`, 'pi');
        }
        if (showHydrophobic && hydrophobicContacts.length > 0) {
          await commitShape(active, 'Hydrophobic Contacts', hydrophobicContacts, buildHydrophobicMesh(hydrophobicContacts, selectedInteractionId), 0xf97316, (g) => `Hydrophobic (${hydrophobicContacts[g].distance} Å)`, 'hc');
        }
      } catch (err) { safeError('Draw Error', err); }
      finally {
        isDrawingRef.current = false;
        if (hasPendingDrawRef.current && active.current) drawInteractions();
      }
    }

    drawInteractions();
    return () => { active.current = false; };
  }, [plugin, isStructureLoaded, saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic, selectedInteractionId]);

  // Fast highlight selection (Redundant with drawInteractions for cylinders, but useful for crosshair)
  useEffect(() => {
    if (!plugin || !isStructureLoaded) return;
    const active = { current: true };

    async function updateHighlight() {
      try {
        if (highlightCellRef.current) {
          const u = plugin!.state.data.build();
          u.delete(highlightCellRef.current);
          highlightCellRef.current = null;
          await u.commit();
        }

        const coords = getSelectedCoords();
        if (coords) {
          const mesh = buildHighlightMesh(coords);
          // Highlight is slightly larger and white to indicate selection
          await commitShape(active, 'Selection Highlight', [{}], mesh, 0xffffff, () => 'Selected Interaction', 'highlight', true);
        }
      } catch (err) { safeError('Highlight Error', err); }
    }

    updateHighlight();
    return () => { active.current = false; };
  }, [plugin, isStructureLoaded, selectedInteractionId]);

  // Selection focus & zoom
  useEffect(() => {
    console.log(`[Viewer3D] Effect: selectedInteractionId changed to ${selectedInteractionId}`);
    if (!plugin || !isStructureLoaded) return;

    if (!selectedInteractionId) {
      plugin.managers.interactivity.lociSelects.deselectAll();
      plugin.managers.structure.focus.clear();
      return;
    }

    const resNums: number[] = [];
    const sb = saltBridges.find(x => x.id === selectedInteractionId); if (sb) resNums.push(sb.positive_residue.number, sb.negative_residue.number);
    const hb = hydrogenBonds.find(x => x.id === selectedInteractionId); if (hb) resNums.push(hb.donor_residue.number, hb.acceptor_residue.number);
    const ss = disulfideBonds.find(x => x.id === selectedInteractionId); if (ss) resNums.push(ss.residue_a.number, ss.residue_b.number);
    const pi = piStacking.find(x => x.id === selectedInteractionId); if (pi) resNums.push(pi.residue_a.number, pi.residue_b.number);
    const hc = hydrophobicContacts.find(x => x.id === selectedInteractionId); if (hc) resNums.push(hc.residue_a.number, hc.residue_b.number);

    if (resNums.length === 0) return;

    try {
      const structures = plugin.managers.structure.hierarchy.current.structures;
      if (!structures.length || !structures[0].cell?.obj?.data) return;
      const script = Script(`resi ${resNums.join('+')}`, 'pymol');
      const loci = Script.toLoci(script, structures[0].cell.obj.data);
      
      if (!StructureElement.Loci.isEmpty(loci)) {
        // Ensure the loci has an associated render object before focusing
        // const hasRenderObject = plugin.canvas3d?.items.some(item => 
        //   item.renderObject.type === 'mesh' || item.renderObject.type === 'lines'
        // );

        // if (hasRenderObject) {
          plugin.managers.interactivity.lociSelects.selectOnly({ loci });
          plugin.managers.structure.focus.setFromLoci(loci);
          plugin.managers.camera.focusLoci(loci, { durationMs: 800 });
        // }
      }
    } catch (err: any) { 
      safeError('Focus Error', err);
    }
  }, [plugin, isStructureLoaded, selectedInteractionId]);

  // Overpaint effect
  useEffect(() => {
    if (!plugin || !isStructureLoaded || !structureRef.current) return;
    
    async function applyColoring() {
      try {
        const structures = plugin!.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;
        const components = structures[0].components;
        await clearStructureOverpaint(plugin!, components);
        
        if (colorMode === 'rmsf' && resFluc) {
          const categories: Record<number, string[]> = { 0xef4444: [], 0xf59e0b: [], 0x3b82f6: [] };
          for (const [key, val] of Object.entries(resFluc)) {
            const [chain, num] = key.split('_');
            const color = val > 0.6 ? 0xef4444 : val > 0.4 ? 0xf59e0b : 0x3b82f6;
            categories[color].push(`(chain ${chain} and resi ${num})`);
          }
          for (const [color, selections] of Object.entries(categories)) {
            if (selections.length === 0) continue;
            const loci = Script.toLoci(Script(selections.join(' or '), 'pymol'), structures[0].cell.obj!.data);
            await setStructureOverpaint(plugin!, components, Color(Number(color)), async () => loci);
          }
        } else if (colorMode === 'allosteric' && allostericPath?.length) {
          const lociAll = Script.toLoci(Script('all', 'pymol'), structures[0].cell.obj!.data);
          await setStructureOverpaint(plugin!, components, Color(0x1a1a1a), async () => lociAll);
          const lociPath = Script.toLoci(Script(allostericPath.map(k => `(chain ${k.split('_')[0]} and resi ${k.split('_')[1]})`).join(' or '), 'pymol'), structures[0].cell.obj!.data);
          await setStructureOverpaint(plugin!, components, Color(0x06b6d4), async () => lociPath);
        }
      } catch (err: any) { 
        safeError('Overpaint Error', err);
      }
    }
    applyColoring();
  }, [plugin, isStructureLoaded, colorMode, resFluc, allostericPath]);

  async function commitShape(active: { current: boolean }, name: string, list: any[], mesh: any, colorHex: number, labelFn: (group: number) => string, key: string, isHighlight = false) {
    if (!active.current || list.length === 0) return;
    
    const { selectedInteractionId } = propsRef.current;
    
    const colorFn = (group: number) => {
      if (isHighlight) return Color(colorHex);
      const item = list[group];
      return Color(item?.id === selectedInteractionId ? 0xffffff : colorHex);
    };

    const shape = Shape.create(name, list, mesh, colorFn, () => 1, labelFn);
    const ref = `${name.toLowerCase().replace(/\s+/g, '-')}-${++nodeCounter}`;
    const shapeNode = await plugin!.build().toRoot().apply(CreateShape, { shape, label: name }, { ref }).commit();
    if (!active.current) return;
    if (isHighlight) highlightCellRef.current = shapeNode; else shapesCellRefs.current[key] = shapeNode;
    await plugin!.build().to(shapeNode).apply(ShapeRepresentation3D, { alpha: isHighlight ? 0.6 : 1.0 }, { ref: `${ref}-repr` }).commit();
  }

  const getSelectedCoords = (): [number, number, number] | null => {
    const { selectedInteractionId, saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts } = propsRef.current;
    if (!selectedInteractionId) return null;
    const sb = saltBridges.find(x => x.id === selectedInteractionId); if (sb) { const p = sb.positive_atom.coordinates, n = sb.negative_atom.coordinates; return [(p[0]+n[0])/2,(p[1]+n[1])/2,(p[2]+n[2])/2]; }
    const hb = hydrogenBonds.find(x => x.id === selectedInteractionId); if (hb) { const d = hb.donor_atom.coordinates, a = hb.acceptor_atom.coordinates; return [(d[0]+a[0])/2,(d[1]+a[1])/2,(d[2]+a[2])/2]; }
    const ss = disulfideBonds.find(x => x.id === selectedInteractionId); if (ss) { const a = ss.atom_a.coordinates, b = ss.atom_b.coordinates; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    const pi = piStacking.find(x => x.id === selectedInteractionId); if (pi) { const a = pi.centroid_a, b = pi.centroid_b; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    const hc = hydrophobicContacts.find(x => x.id === selectedInteractionId); if (hc) { const a = hc.atom_a.coordinates, b = hc.atom_b.coordinates; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    return null;
  };

  const buildHighlightMesh = (coords: [number, number, number]) => {
    const s = MeshBuilder.createState(32, 16);
    s.currentGroup = 0;
    const r = 0.6;
    addCylinder(s, Vec3.create(coords[0]-r, coords[1], coords[2]), Vec3.create(coords[0]+r, coords[1], coords[2]), 1.0, { radiusTop: 0.1, radiusBottom: 0.1 });
    addCylinder(s, Vec3.create(coords[0], coords[1]-r, coords[2]), Vec3.create(coords[0], coords[1]+r, coords[2]), 1.0, { radiusTop: 0.1, radiusBottom: 0.1 });
    addCylinder(s, Vec3.create(coords[0], coords[1], coords[2]-r), Vec3.create(coords[0], coords[1], coords[2]+r), 1.0, { radiusTop: 0.1, radiusBottom: 0.1 });
    return MeshBuilder.getMesh(s);
  };

  const buildSaltBridgesMesh = (list: SaltBridge[]) => {
    const s = MeshBuilder.createState(list.length * 8, list.length * 4);
    list.forEach((sb, idx) => { s.currentGroup = idx; addCylinder(s, Vec3.create(sb.positive_atom.coordinates[0], sb.positive_atom.coordinates[1], sb.positive_atom.coordinates[2]), Vec3.create(sb.negative_atom.coordinates[0], sb.negative_atom.coordinates[1], sb.negative_atom.coordinates[2]), 1.0, { radiusTop: 0.30, radiusBottom: 0.30 }); });
    return MeshBuilder.getMesh(s);
  };

  const buildHydrogenBondsMesh = (list: HydrogenBond[]) => {
    const s = MeshBuilder.createState(list.length * 16, list.length * 8);
    list.forEach((hb, idx) => {
      s.currentGroup = idx;
      const start = Vec3.create(hb.donor_atom.coordinates[0], hb.donor_atom.coordinates[1], hb.donor_atom.coordinates[2]);
      const end = Vec3.create(hb.acceptor_atom.coordinates[0], hb.acceptor_atom.coordinates[1], hb.acceptor_atom.coordinates[2]);
      const dir = Vec3.sub(Vec3(), end, start);
      const len = Vec3.magnitude(dir);
      Vec3.normalize(dir, dir);
      const segs = 6; const segLen = len / segs;
      for (let i = 0; i < segs; i += 2) {
        addCylinder(s, Vec3.scaleAndAdd(Vec3(), start, dir, i * segLen), Vec3.scaleAndAdd(Vec3(), start, dir, (i+1) * segLen), 1.0, { radiusTop: 0.20, radiusBottom: 0.20 });
      }
    });
    return MeshBuilder.getMesh(s);
  };

  const buildDisulfideMesh = (list: DisulfideBond[]) => {
    const s = MeshBuilder.createState(list.length * 8, list.length * 4);
    list.forEach((ss, idx) => { s.currentGroup = idx; addCylinder(s, Vec3.create(ss.atom_a.coordinates[0], ss.atom_a.coordinates[1], ss.atom_a.coordinates[2]), Vec3.create(ss.atom_b.coordinates[0], ss.atom_b.coordinates[1], ss.atom_b.coordinates[2]), 1.0, { radiusTop: 0.40, radiusBottom: 0.40 }); });
    return MeshBuilder.getMesh(s);
  };

  const buildPiStackMesh = (list: PiStack[]) => {
    const s = MeshBuilder.createState(list.length * 12, list.length * 6);
    list.forEach((pi, idx) => { s.currentGroup = idx; addCylinder(s, Vec3.create(pi.centroid_a[0], pi.centroid_a[1], pi.centroid_a[2]), Vec3.create(pi.centroid_b[0], pi.centroid_b[1], pi.centroid_b[2]), 1.0, { radiusTop: 0.25, radiusBottom: 0.25 }); });
    return MeshBuilder.getMesh(s);
  };

  const buildHydrophobicMesh = (list: HydrophobicContact[]) => {
    const s = MeshBuilder.createState(list.length * 12, list.length * 6);
    list.forEach((hc, idx) => { s.currentGroup = idx; addCylinder(s, Vec3.create(hc.atom_a.coordinates[0], hc.atom_a.coordinates[1], hc.atom_a.coordinates[2]), Vec3.create(hc.atom_b.coordinates[0], hc.atom_b.coordinates[1], hc.atom_b.coordinates[2]), 1.0, { radiusTop: 0.20, radiusBottom: 0.20 }); });
    return MeshBuilder.getMesh(s);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-black/40">
      <div ref={containerRef} className="flex-1 w-full relative" id="molstar-viewport" />

      {loading && (
        <div className="absolute inset-0 bg-[#020202]/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50 animate-in fade-in duration-500">
          <div className="w-12 h-12 rounded-full border-t-2 border-cyan-500 animate-spin" />
          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.3em] animate-pulse">Syncing_Orbital_Stream...</p>
        </div>
      )}

      {/* Selected HUD Overlay */}
      {selectedDetails && (
        <div className="absolute bottom-6 left-6 z-50 w-64 bg-black/90 border border-white/[0.08] rounded p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left-4 duration-500">
           <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: selectedDetails.color }} />
           <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">[ANALYSIS_CH_ACTIVE]</span>
                <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: selectedDetails.color }}>{selectedDetails.type}</span>
              </div>
              <button onClick={() => onSelectInteraction(null)} className="text-slate-600 hover:text-white transition-colors"><X className="h-3 w-3" /></button>
           </div>
           
           <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold font-mono">
                <span className="text-slate-300">{selectedDetails.resA}</span>
                <div className="h-[1px] flex-1 mx-3 bg-white/5 relative">
                   <div className="absolute inset-0 bg-white/10 animate-pulse" />
                </div>
                <span className="text-slate-300">{selectedDetails.resB}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                    <p className="text-[7px] text-slate-600 font-bold uppercase">Metric_Dist</p>
                    <p className="text-[11px] text-cyan-400 font-bold font-mono">{selectedDetails.distance.toFixed(3)}Å</p>
                 </div>
                 <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                    <p className="text-[7px] text-slate-600 font-bold uppercase">Energy_KJ</p>
                    <p className="text-[11px] text-emerald-500 font-bold font-mono">{selectedDetails.energy?.toFixed(1) || '—'}</p>
                 </div>
              </div>
              
              {selectedDetails.extra && (
                <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest bg-white/[0.02] p-1.5 rounded border border-white/[0.03] text-center">
                  :: {selectedDetails.extra}
                </div>
              )}
           </div>
        </div>
      )}

      {/* Floating Viewport Controls */}
      <div className="absolute top-6 left-6 z-40 flex flex-col gap-2">
         <div className="px-3 py-1.5 bg-black/60 border border-white/[0.05] rounded backdrop-blur-md flex items-center gap-4 shadow-xl">
            <div className="flex items-center gap-2">
               <Target className="h-3 w-3 text-cyan-500" />
               <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Aura_Enabled</span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <span className="text-[8px] text-slate-600 uppercase tracking-tighter">L-Click: Select // R-Drag: Pan // Scroll: Zoom</span>
         </div>
      </div>
    </div>
  );
}
