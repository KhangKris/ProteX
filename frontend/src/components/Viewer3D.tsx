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

import 'molstar/build/viewer/molstar.css';

import { HydrogenBond, SaltBridge, DisulfideBond, PiStack, HydrophobicContact, getFileUrl } from '../utils/api';

// Define the custom CreateShape transformer for Mol* State, re-using it if already registered (e.g., during HMR)
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
}: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isStructureLoaded, setIsStructureLoaded] = useState(false);

  // References to keep track of loaded Mol* state cells/nodes
  const structureRef = useRef<any>(null);
  const saltBridgesCellRef = useRef<any>(null);
  const hBondsCellRef = useRef<any>(null);
  const disulfideCellRef = useRef<any>(null);
  const piStackCellRef = useRef<any>(null);
  const hydrophobicCellRef = useRef<any>(null);
  const highlightCellRef = useRef<any>(null); // glowing sphere for selected interaction
  const isDrawingRef = useRef(false);
  const hasPendingDrawRef = useRef(false);

  // Keep latest props in refs to avoid stale closure in subscription callback
  const saltBridgesRef = useRef(saltBridges);
  const hydrogenBondsRef = useRef(hydrogenBonds);
  const disulfideBondsRef = useRef(disulfideBonds);
  const piStackingRef = useRef(piStacking);
  const hydrophobicContactsRef = useRef(hydrophobicContacts);
  const onSelectInteractionRef = useRef(onSelectInteraction);

  useEffect(() => {
    saltBridgesRef.current = saltBridges;
    hydrogenBondsRef.current = hydrogenBonds;
    disulfideBondsRef.current = disulfideBonds;
    piStackingRef.current = piStacking;
    hydrophobicContactsRef.current = hydrophobicContacts;
    onSelectInteractionRef.current = onSelectInteraction;
  }, [saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts, onSelectInteraction]);

  // Initialize Mol* Plugin
  useEffect(() => {
    let pluginInstance: PluginUIContext | null = null;
    let clickSub: any = null;
    let initTimeoutId: any = null;

    async function init() {
      console.log('[DEBUG] init() started. containerRef.current exists:', !!containerRef.current);
      if (!containerRef.current) return;

      const spec = DefaultPluginUISpec();
      spec.layout = {
        initial: {
          showControls: false,
          isExpanded: false
        }
      };
      
      spec.config = [
        [PluginConfig.Viewport.ShowAnimation, false],
        [PluginConfig.Viewport.ShowTrajectoryControls, false]
      ];

      try {
        console.log('[DEBUG] Invoking createPluginUI...');
        const p = await createPluginUI(containerRef.current, spec);
        console.log('[DEBUG] createPluginUI returned plugin context successfully');
        
        // Set canvas background to matching slate dark color
        if (p.canvas3d) {
          console.log('[DEBUG] canvas3d is present, setting dark background');
          p.canvas3d.setProps({
            renderer: { backgroundColor: Color(0x0f172a) }
          });
        } else {
          console.log('[DEBUG] canvas3d is NOT present on plugin context');
        }

        // Set up custom selection interaction click handler
        clickSub = p.behaviors.interaction.click.subscribe((event) => {
          const loci = event.current.loci;
          if (Loci.isEmpty(loci)) return;
          if (ShapeGroup.isLoci(loci)) {
            const shape = loci.shape;
            if (shape.name === 'Salt Bridges' || shape.name === 'Hydrogen Bonds') {
              const firstGroup = loci.groups[0];
              if (firstGroup) {
                const group = OrderedSet.getAt(firstGroup.ids, 0);
                if (group !== undefined) {
                  const list = shape.name === 'Salt Bridges' ? saltBridgesRef.current : hydrogenBondsRef.current;
                  const item = list[group];
                  if (item) {
                    onSelectInteractionRef.current(item.id);
                  }
                }
              }
            }
          }
        });

        pluginInstance = p;
        setPlugin(p);
        console.log('[DEBUG] setPlugin execution completed successfully');
      } catch (err: any) {
        console.error('[ERROR] Failed to initialize Mol* viewer:', err);
        setError('Failed to initialize 3D molecular viewer');
      }
    }

    initTimeoutId = setTimeout(() => {
      init();
    }, 100);

    return () => {
      console.log('[DEBUG] useEffect cleanup running. Clearing timeout and disposing plugin if exists.');
      if (initTimeoutId) clearTimeout(initTimeoutId);
      if (clickSub) clickSub.unsubscribe();
      if (pluginInstance) {
        pluginInstance.dispose();
      }
    };
  }, []);

  // Load structure file when fileId changes
  useEffect(() => {
    if (!plugin || !fileId) return;

    async function loadStructure() {
      setLoading(true);
      setError(null);
      setIsStructureLoaded(false);

      const fileUrl = getFileUrl(fileId!);
      const ext = extension || '.pdb';
      const isCif = ext === '.cif' || ext === '.mmcif';
      
      console.log(`[DEBUG] Starting loadStructure. fileId=${fileId}, ext=${ext}, url=${fileUrl}`);

      try {
        // 1. Clear previous structure & shapes
        await clearViewer();
        console.log('[DEBUG] 1. Viewer cleared successfully');

        // 2. Download and parse structure file
        console.log('[DEBUG] 2. Downloading structure file...');
        const data = await plugin!.builders.data.download({ url: fileUrl }, { state: { isGhost: true } });
        console.log('[DEBUG] 2. Download completed. Parsing trajectory...');
        const trajectory = await plugin!.builders.structure.parseTrajectory(data, isCif ? 'mmcif' : 'pdb');
        console.log('[DEBUG] 2. Trajectory parsing completed');
        
        // 3. Apply default hierarchy preset (creates model, structure, and automatic representations)
        console.log('[DEBUG] 3. Applying hierarchy preset...');
        const preset = await plugin!.builders.structure.hierarchy.applyPreset(trajectory, 'default');
        console.log('[DEBUG] 3. Preset application completed');
        
        if (preset && preset.structure) {
          structureRef.current = preset.structure;
        } else {
          // Fallback: get first structure cell from hierarchy manager
          const currentStructures = plugin!.managers.structure.hierarchy.current.structures;
          if (currentStructures.length > 0) {
            structureRef.current = currentStructures[0].cell;
          }
        }
        console.log(`[DEBUG] Structure reference: ${structureRef.current ? 'Found' : 'Missing'}`);

        // 4. Zoom to structure
        plugin!.managers.camera.reset();
        console.log('[DEBUG] 4. Camera reset completed');
        setIsStructureLoaded(true);
      } catch (err: any) {
        console.error('Failed to load protein structure:', err);
        setError(`Failed to load protein structure: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    loadStructure();
  }, [plugin, fileId, retryCount]);

  // ─── Helper: commit a single shape layer ──────────────────────────────────
  async function commitShape(
    active: { current: boolean },
    name: string,
    data: any[],
    mesh: any,
    colorHex: number,
    labelFn: (group: number) => string,
    cellRef: MutableRefObject<any>
  ) {
    if (!active.current || data.length === 0) return;
    const shape = Shape.create(name, data, mesh, () => Color(colorHex), () => 1, labelFn);
    const ref = `${name.toLowerCase().replace(/\s+/g, '-')}-${++nodeCounter}`;
    const reprRef = `${ref}-repr`;
    const shapeNode = await plugin!.build().toRoot().apply(CreateShape, { shape, label: name }, { ref }).commit();
    if (!active.current) return;
    cellRef.current = shapeNode;
    await plugin!.build().to(shapeNode).apply(ShapeRepresentation3D, {}, { ref: reprRef }).commit();
    if (!active.current) return;
    console.log(`[DEBUG] ${name} rendered successfully`);
  }

  // ─── Main interaction drawing effect ──────────────────────────────────────
  useEffect(() => {
    // Only require plugin + isStructureLoaded — do NOT gate on structureRef.current
    // (structureRef may be null for some preset configurations yet shapes still work via toRoot)
    if (!plugin || !isStructureLoaded) return;

    const active = { current: true };

    async function drawInteractions() {
      if (isDrawingRef.current) {
        hasPendingDrawRef.current = true;
        return;
      }
      isDrawingRef.current = true;
      hasPendingDrawRef.current = false;

      try {
        console.log('[DEBUG] drawInteractions() started.');

        // 1. Delete ALL previous shape cells in a single commit
        const update = plugin!.state.data.build();
        let changed = false;
        const allCellRefs = [
          saltBridgesCellRef, hBondsCellRef,
          disulfideCellRef, piStackCellRef, hydrophobicCellRef, highlightCellRef,
        ];
        for (const ref of allCellRefs) {
          if (ref.current) {
            update.delete(ref.current);
            ref.current = null;
            changed = true;
          }
        }
        if (changed) {
          await update.commit();
          console.log('[DEBUG] All previous shapes deleted');
        }

        if (!active.current) return;

        // 2. Render Salt Bridges — yellow solid thick cylinders
        if (showSaltBridges && saltBridges.length > 0) {
          await commitShape(active, 'Salt Bridges', saltBridges, buildSaltBridgesMesh(), 0xfbbf24,
            (g) => {
              const sb = saltBridges[g];
              if (!sb) return 'Salt Bridge';
              return `Salt Bridge (${sb.distance} Å): ${sb.positive_residue.name}${sb.positive_residue.number} – ${sb.negative_residue.name}${sb.negative_residue.number}`;
            }, saltBridgesCellRef);
        }

        // 3. Render Hydrogen Bonds — cyan dashed thin cylinders
        if (showHydrogenBonds && hydrogenBonds.length > 0) {
          await commitShape(active, 'Hydrogen Bonds', hydrogenBonds, buildHydrogenBondsMesh(), 0x06b6d4,
            (g) => {
              const hb = hydrogenBonds[g];
              if (!hb) return 'Hydrogen Bond';
              const angleText = hb.angle ? `, ${hb.angle}°` : '';
              return `H-Bond (${hb.distance} Å${angleText}): ${hb.donor_residue.name}${hb.donor_residue.number} → ${hb.acceptor_residue.name}${hb.acceptor_residue.number}${hb.fallback ? ' [fallback]' : ''}`;
            }, hBondsCellRef);
        }

        // 4. Render Disulfide Bonds — gold solid thick cylinders
        if (showDisulfideBonds && disulfideBonds.length > 0) {
          await commitShape(active, 'Disulfide Bonds', disulfideBonds, buildDisulfideMesh(), 0xd4a017,
            (g) => {
              const ss = disulfideBonds[g];
              if (!ss) return 'Disulfide Bond';
              return `S–S Bond (${ss.distance} Å): CYS${ss.residue_a.number} – CYS${ss.residue_b.number}`;
            }, disulfideCellRef);
        }

        // 5. Render Pi-Pi Stacking — purple dashed cylinders
        if (showPiStacking && piStacking.length > 0) {
          await commitShape(active, 'Pi Stacking', piStacking, buildPiStackMesh(), 0xa855f7,
            (g) => {
              const pi = piStacking[g];
              if (!pi) return 'π–π Stacking';
              return `π–π ${pi.stack_type} (${pi.distance} Å, ${pi.angle}°): ${pi.residue_a.name}${pi.residue_a.number} – ${pi.residue_b.name}${pi.residue_b.number}`;
            }, piStackCellRef);
        }

        // 6. Render Hydrophobic Contacts — orange dotted cylinders
        if (showHydrophobic && hydrophobicContacts.length > 0) {
          await commitShape(active, 'Hydrophobic Contacts', hydrophobicContacts, buildHydrophobicMesh(), 0xf97316,
            (g) => {
              const hc = hydrophobicContacts[g];
              if (!hc) return 'Hydrophobic Contact';
              return `Hydrophobic (${hc.distance} Å): ${hc.residue_a.name}${hc.residue_a.number} – ${hc.residue_b.name}${hc.residue_b.number}`;
            }, hydrophobicCellRef);
        }

        console.log('[DEBUG] drawInteractions() completed successfully.');
      } catch (err: any) {
        console.error('[ERROR] Failed to draw interactions:', err);
      } finally {
        isDrawingRef.current = false;
        if (hasPendingDrawRef.current && active.current) {
          drawInteractions();
        }
      }
    }

    drawInteractions();

    return () => {
      active.current = false;
    };
  }, [
    plugin, fileId, isStructureLoaded,
    showSaltBridges, showHydrogenBonds, showDisulfideBonds, showPiStacking, showHydrophobic,
    saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts,
  ]);

  // ─── Fast highlight effect (selection only — doesn’t redraw all shapes) ───────────
  useEffect(() => {
    if (!plugin || !isStructureLoaded) return;
    let cancelled = false;
    const active = { current: true };

    async function updateHighlight() {
      try {
        // Remove previous highlight
        if (highlightCellRef.current) {
          const u = plugin!.state.data.build();
          u.delete(highlightCellRef.current);
          highlightCellRef.current = null;
          await u.commit();
          if (cancelled) return;
        }

        // Add new highlight if something is selected
        const hlCoords = getSelectedCoords();
        if (hlCoords) {
          const hlMesh = buildHighlightMesh(hlCoords);
          await commitShape(active, 'Selection Highlight', [{}], hlMesh, 0xffffff,
            () => 'Selected Interaction', highlightCellRef);
        }
      } catch (err) {
        console.error('[ERROR] Failed to update highlight:', err);
      }
    }

    updateHighlight();
    return () => { cancelled = true; active.current = false; };
  }, [plugin, isStructureLoaded, selectedInteractionId]);

  // Select & focus the interacting residues on the 3D structure when a table row is clicked
  useEffect(() => {
    if (!plugin) return;

    // If nothing is selected, clear any existing selection highlights
    if (!selectedInteractionId) {
      plugin.managers.interactivity.lociSelects.deselectAll();
      plugin.managers.structure.focus.clear();
      return;
    }

    // Collect the residue numbers involved in this interaction
    const residueNumbers: number[] = [];

    const sb = saltBridges.find(x => x.id === selectedInteractionId);
    if (sb) { residueNumbers.push(sb.positive_residue.number, sb.negative_residue.number); }

    if (residueNumbers.length === 0) {
      const hb = hydrogenBonds.find(x => x.id === selectedInteractionId);
      if (hb) { residueNumbers.push(hb.donor_residue.number, hb.acceptor_residue.number); }
    }
    if (residueNumbers.length === 0) {
      const ss = disulfideBonds.find(x => x.id === selectedInteractionId);
      if (ss) { residueNumbers.push(ss.residue_a.number, ss.residue_b.number); }
    }
    if (residueNumbers.length === 0) {
      const pi = piStacking.find(x => x.id === selectedInteractionId);
      if (pi) { residueNumbers.push(pi.residue_a.number, pi.residue_b.number); }
    }
    if (residueNumbers.length === 0) {
      const hc = hydrophobicContacts.find(x => x.id === selectedInteractionId);
      if (hc) { residueNumbers.push(hc.residue_a.number, hc.residue_b.number); }
    }

    if (residueNumbers.length === 0) return;

    try {
      // Get the loaded structure from Mol*'s hierarchy
      const structures = plugin.managers.structure.hierarchy.current.structures;
      if (!structures.length || !structures[0].cell?.obj?.data) return;
      const structure = structures[0].cell.obj.data;

      // Build a PyMOL-style selection string for the residues: "resi 27+34"
      const resiStr = residueNumbers.join('+');
      const script = Script(`resi ${resiStr}`, 'pymol');
      const loci = Script.toLoci(script, structure);

      if (StructureElement.Loci.isEmpty(loci)) {
        console.warn('[WARN] Could not find residues', residueNumbers, 'in structure');
        return;
      }

      // Clear previous selection and apply new one
      plugin.managers.interactivity.lociSelects.deselectAll();
      plugin.managers.interactivity.lociSelects.selectOnly({ loci });

      // Focus + zoom camera onto the selected residues
      plugin.managers.structure.focus.setFromLoci(loci);
      plugin.managers.camera.focusLoci(loci, { durationMs: 800 });
    } catch (err) {
      console.error('[ERROR] Failed to select interaction residues:', err);
      // Fallback: just move camera to midpoint
      const coords = getSelectedCoords();
      if (coords) {
        plugin.managers.camera.focusSphere(
          Sphere3D.create(Vec3.create(coords[0], coords[1], coords[2]), 8),
          { durationMs: 800 }
        );
      }
    }
  }, [plugin, selectedInteractionId, saltBridges, hydrogenBonds, disulfideBonds, piStacking, hydrophobicContacts]);

  const clearViewer = async () => {
    if (plugin) {
      await plugin.clear();
      structureRef.current = null;
      saltBridgesCellRef.current = null;
      hBondsCellRef.current = null;
      disulfideCellRef.current = null;
      piStackCellRef.current = null;
      hydrophobicCellRef.current = null;
      highlightCellRef.current = null;
    }
  };

  // ─── Mesh Builders ────────────────────────────────────────────────────────

  /** Returns midpoint coords of the currently selected interaction, or null */
  const getSelectedCoords = (): [number, number, number] | null => {
    if (!selectedInteractionId) return null;
    const sb = saltBridges.find(x => x.id === selectedInteractionId);
    if (sb) { const p = sb.positive_atom.coordinates, n = sb.negative_atom.coordinates; return [(p[0]+n[0])/2,(p[1]+n[1])/2,(p[2]+n[2])/2]; }
    const hb = hydrogenBonds.find(x => x.id === selectedInteractionId);
    if (hb) { const d = hb.donor_atom.coordinates, a = hb.acceptor_atom.coordinates; return [(d[0]+a[0])/2,(d[1]+a[1])/2,(d[2]+a[2])/2]; }
    const ss = disulfideBonds.find(x => x.id === selectedInteractionId);
    if (ss) { const a = ss.atom_a.coordinates, b = ss.atom_b.coordinates; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    const pi = piStacking.find(x => x.id === selectedInteractionId);
    if (pi) { const a = pi.centroid_a, b = pi.centroid_b; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    const hc = hydrophobicContacts.find(x => x.id === selectedInteractionId);
    if (hc) { const a = hc.atom_a.coordinates, b = hc.atom_b.coordinates; return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; }
    return null;
  };

  /** Builds a pulsing highlight: 3 concentric rings at the midpoint of the selected bond */
  const buildHighlightMesh = (coords: [number, number, number]) => {
    const s = MeshBuilder.createState(64, 32);
    s.currentGroup = 0;
    // Draw three orthogonal ring discs as cylinder pairs to create a glowing orb feel
    const r = 0.30;
    const axes: [Vec3, Vec3][] = [
      [Vec3.create(coords[0]-r, coords[1], coords[2]), Vec3.create(coords[0]+r, coords[1], coords[2])],
      [Vec3.create(coords[0], coords[1]-r, coords[2]), Vec3.create(coords[0], coords[1]+r, coords[2])],
      [Vec3.create(coords[0], coords[1], coords[2]-r), Vec3.create(coords[0], coords[1], coords[2]+r)],
    ];
    for (const [a, b] of axes) {
      addCylinder(s, a, b, 1.0, { radiusTop: r * 0.7, radiusBottom: r * 0.7 });
    }
    // Extra outer ring
    const ro = 0.55;
    addCylinder(s, Vec3.create(coords[0]-ro, coords[1], coords[2]), Vec3.create(coords[0]+ro, coords[1], coords[2]), 1.0, { radiusTop: ro * 0.2, radiusBottom: ro * 0.2 });
    addCylinder(s, Vec3.create(coords[0], coords[1]-ro, coords[2]), Vec3.create(coords[0], coords[1]+ro, coords[2]), 1.0, { radiusTop: ro * 0.2, radiusBottom: ro * 0.2 });
    addCylinder(s, Vec3.create(coords[0], coords[1], coords[2]-ro), Vec3.create(coords[0], coords[1], coords[2]+ro), 1.0, { radiusTop: ro * 0.2, radiusBottom: ro * 0.2 });
    return MeshBuilder.getMesh(s);
  };


  const buildSaltBridgesMesh = () => {
    const s = MeshBuilder.createState(256, 128);
    const r = 0.15;
    saltBridges.forEach((sb, idx) => {
      const a = sb.positive_atom.coordinates, b = sb.negative_atom.coordinates;
      s.currentGroup = idx;
      addCylinder(s, Vec3.create(a[0],a[1],a[2]), Vec3.create(b[0],b[1],b[2]), 1.0, { radiusTop: r, radiusBottom: r });
    });
    return MeshBuilder.getMesh(s);
  };

  /** Thin dashed cylinders — Hydrogen Bonds (cyan), no endpoint dots */
  const buildHydrogenBondsMesh = () => {
    const s = MeshBuilder.createState(512, 256);
    const r = 0.06;
    const segments = 8;
    hydrogenBonds.forEach((hb, idx) => {
      const startC = hb.donor_atom.coordinates, endC = hb.acceptor_atom.coordinates;
      const start = Vec3.create(startC[0],startC[1],startC[2]);
      const end = Vec3.create(endC[0],endC[1],endC[2]);
      const dir = Vec3.sub(Vec3(), end, start);
      const len = Vec3.magnitude(dir);
      Vec3.normalize(dir, dir);
      const segLen = len / segments;
      s.currentGroup = idx;
      for (let i = 0; i < segments; i++) {
        if (i % 2 === 0) {
          const sS = Vec3.scaleAndAdd(Vec3(), start, dir, i * segLen);
          const sE = Vec3.scaleAndAdd(Vec3(), start, dir, (i + 1) * segLen);
          addCylinder(s, sS, sE, 1.0, { radiusTop: r, radiusBottom: r });
        }
      }
    });
    return MeshBuilder.getMesh(s);
  };

  /** Thick solid cylinders — Disulfide Bonds (gold) */
  const buildDisulfideMesh = () => {
    const s = MeshBuilder.createState(128, 64);
    const r = 0.20;
    disulfideBonds.forEach((ss, idx) => {
      const a = ss.atom_a.coordinates, b = ss.atom_b.coordinates;
      s.currentGroup = idx;
      addCylinder(s, Vec3.create(a[0],a[1],a[2]), Vec3.create(b[0],b[1],b[2]), 1.0, { radiusTop: r, radiusBottom: r });
    });
    return MeshBuilder.getMesh(s);
  };

  /** Dashed thin cylinders — π–π Stacking (purple), centroid to centroid */
  const buildPiStackMesh = () => {
    const s = MeshBuilder.createState(256, 128);
    const r = 0.07;
    const segments = 6;
    piStacking.forEach((pi, idx) => {
      const start = Vec3.create(pi.centroid_a[0], pi.centroid_a[1], pi.centroid_a[2]);
      const end = Vec3.create(pi.centroid_b[0], pi.centroid_b[1], pi.centroid_b[2]);
      const dir = Vec3.sub(Vec3(), end, start);
      const len = Vec3.magnitude(dir);
      Vec3.normalize(dir, dir);
      const segLen = len / segments;
      s.currentGroup = idx;
      for (let i = 0; i < segments; i++) {
        if (i % 2 === 0) {
          const sS = Vec3.scaleAndAdd(Vec3(), start, dir, i * segLen);
          const sE = Vec3.scaleAndAdd(Vec3(), start, dir, (i + 1) * segLen);
          addCylinder(s, sS, sE, 1.0, { radiusTop: r, radiusBottom: r });
        }
      }
    });
    return MeshBuilder.getMesh(s);
  };

  /** Very short dotted cylinders — Hydrophobic Contacts (orange) */
  const buildHydrophobicMesh = () => {
    const s = MeshBuilder.createState(256, 128);
    const r = 0.06;
    const segments = 12;
    hydrophobicContacts.forEach((hc, idx) => {
      const start = Vec3.create(hc.atom_a.coordinates[0], hc.atom_a.coordinates[1], hc.atom_a.coordinates[2]);
      const end = Vec3.create(hc.atom_b.coordinates[0], hc.atom_b.coordinates[1], hc.atom_b.coordinates[2]);
      const dir = Vec3.sub(Vec3(), end, start);
      const len = Vec3.magnitude(dir);
      Vec3.normalize(dir, dir);
      // dot pattern: very short segments (1/4 of dash length) with large gaps
      const dotLen = len / segments * 0.4;
      const gap = len / segments;
      s.currentGroup = idx;
      for (let i = 0; i < segments; i++) {
        const sS = Vec3.scaleAndAdd(Vec3(), start, dir, i * gap);
        const sE = Vec3.scaleAndAdd(Vec3(), start, dir, i * gap + dotLen);
        addCylinder(s, sS, sE, 1.0, { radiusTop: r, radiusBottom: r });
      }
    });
    return MeshBuilder.getMesh(s);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col items-stretch glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* 3D viewport canvas target */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[450px]" id="molstar-viewport" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
          <p className="text-slate-300 font-medium">Loading macromolecule structures...</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center gap-4 z-50">
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-slate-200 font-semibold">{error}</p>
          <button 
            onClick={() => { setError(null); setRetryCount(prev => prev + 1); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Camera help HUD overlay */}
      <div className="absolute top-4 left-4 pointer-events-none glass-panel px-3 py-1.5 rounded-lg text-[10px] text-slate-400 flex gap-4 select-none z-10">
        <div><span className="text-neon-cyan font-bold">Rotate:</span> Left Click + Drag</div>
        <div><span className="text-neon-cyan font-bold">Zoom:</span> Scroll Wheel</div>
        <div><span className="text-neon-cyan font-bold">Pan:</span> Right Click + Drag</div>
      </div>
    </div>
  );
}
