"use strict";
/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wwPDBStructConnExtensionFunctions = void 0;
var tslib_1 = require("tslib");
var mmcif_1 = require("../../../mol-model-formats/structure/mmcif");
var objects_1 = require("../../../mol-plugin-state/objects");
var model_1 = require("../../../mol-plugin-state/transforms/model");
var representation_1 = require("../../../mol-plugin-state/transforms/representation");
var state_1 = require("../../../mol-plugin/behavior/static/state");
var builder_1 = require("../../../mol-script/language/builder");
var names_1 = require("../../../mol-util/color/names");
/** Amount by which to expand the camera radius when zooming to atoms involved in struct_conn (angstroms) */
var EXTRA_RADIUS = 4;
/** Tags for state tree nodes managed by this extension  */
var TAGS = {
    RESIDUE_SEL: 'structconn-focus-residue-sel',
    ATOM_SEL: 'structconn-focus-atom-sel',
    RESIDUE_REPR: 'structconn-focus-residue-repr',
    RESIDUE_NCI_REPR: 'structconn-focus-residue-nci-repr',
    ATOM_REPR: 'structconn-focus-atom-repr',
};
/** Parameters for 3D representation of atoms involved in struct_conn (pink bubbles) */
var ATOMS_VISUAL_PARAMS = {
    type: { name: 'ball-and-stick', params: { sizeFactor: 0.25, sizeAspectRatio: 0.73, adjustCylinderLength: true, xrayShaded: true, aromaticBonds: false, multipleBonds: 'off', dashCount: 1, dashCap: false } },
    colorTheme: { name: 'uniform', params: { value: names_1.ColorNames.magenta } },
    sizeTheme: { name: 'physical', params: {} },
};
/** Parameters for 3D representation of residues involved in struct_conn (normal ball-and-stick) */
var RESIDUES_VISUAL_PARAMS = {
    type: { name: 'ball-and-stick', params: { sizeFactor: 0.16 } },
    colorTheme: { name: 'element-symbol', params: {} },
    sizeTheme: { name: 'physical', params: {} },
};
/** All public functions provided by the StructConn extension  */
exports.wwPDBStructConnExtensionFunctions = {
    /** Return an object with all struct_conn records for a loaded structure.
     * Applies to the first structure belonging to `entry` (e.g. '1tqn'),
     * or to the first loaded structure overall if `entry` is `undefined`.
     */
    getStructConns: function (plugin, entry) {
        var _a;
        var structNode = selectStructureNode(plugin, entry);
        var structure = (_a = structNode === null || structNode === void 0 ? void 0 : structNode.obj) === null || _a === void 0 ? void 0 : _a.data;
        if (structure)
            return extractStructConns(structure.model);
        else
            return {};
    },
    /** Create visuals for residues and atoms involved in a struct_conn with ID `structConnId`
     * and zoom on them. If `keepExisting` is false (default), remove any such visuals created by previous calls to this function.
     * Also hide all carbohydrate SNFG visuals within the structure (as they would occlude our residues of interest).
     * Return a promise that resolves to the number of involved atoms which were successfully selected (2, 1, or 0).
     */
    inspectStructConn: function (plugin, entry, structConnId, keepExisting) {
        var _a, _b;
        var _c;
        if (keepExisting === void 0) { keepExisting = false; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var structNode, structure, conns, conn, nSelectedAtoms;
            return tslib_1.__generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        structNode = selectStructureNode(plugin, entry);
                        structure = (_a = structNode === null || structNode === void 0 ? void 0 : structNode.obj) === null || _a === void 0 ? void 0 : _a.data;
                        if (!structure) {
                            console.error('Structure not found');
                            return [2 /*return*/, 0];
                        }
                        conns = (_b = (_c = structure.model._staticPropertyData)['wwpdb-struct-conn-extension-data']) !== null && _b !== void 0 ? _b : (_c['wwpdb-struct-conn-extension-data'] = extractStructConns(structure.model));
                        conn = conns[structConnId];
                        if (!conn) {
                            console.error("The structure does not contain struct_conn \"".concat(structConnId, "\""));
                            return [2 /*return*/, 0];
                        }
                        if (!!keepExisting) return [3 /*break*/, 2];
                        return [4 /*yield*/, removeAllStructConnInspections(plugin, structNode)];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2: return [4 /*yield*/, addStructConnInspection(plugin, structNode, conn)];
                    case 3:
                        nSelectedAtoms = _d.sent();
                        hideSnfgNodes(plugin, structNode);
                        return [2 /*return*/, nSelectedAtoms];
                }
            });
        });
    },
    /** Remove anything created by `inspectStructConn` within the structure and
     * make visible any carbohydrate SNFG visuals that have been hidden by `inspectStructConn`.
     */
    clearStructConnInspections: function (plugin, entry) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var structNode;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        structNode = selectStructureNode(plugin, entry);
                        if (!structNode)
                            return [2 /*return*/];
                        return [4 /*yield*/, removeAllStructConnInspections(plugin, structNode)];
                    case 1:
                        _a.sent();
                        unhideSnfgNodes(plugin, structNode);
                        return [2 /*return*/];
                }
            });
        });
    },
};
/** Return the first structure node belonging to `entry` (e.g. '1tqn'),
 * or to the first loaded structure node overall if `entry` is `undefined`.
 * Includes only "root" structures, not structure components. */
function selectStructureNode(plugin, entry) {
    var structNodes = plugin.state.data
        .selectQ(function (q) { return q.rootsOfType(objects_1.PluginStateObject.Molecule.Structure); });
    if (entry) {
        var result = structNodes.find(function (node) { return node.obj && node.obj.data.model.entry.toLowerCase() === entry.toLowerCase(); });
        if (!result) {
            console.warn("Structure with entry ID \"".concat(entry, "\" was not found. Available structures: ").concat(structNodes.map(function (node) { var _a; return (_a = node.obj) === null || _a === void 0 ? void 0 : _a.data.model.entry; })));
        }
        return result;
    }
    else {
        if (structNodes.length > 1) {
            console.warn("Structure entry ID was not specified, but there is more than one loaded structure (".concat(structNodes.map(function (node) { var _a; return (_a = node.obj) === null || _a === void 0 ? void 0 : _a.data.model.entry; }), "). Taking the first structure."));
        }
        if (structNodes.length === 0) {
            console.warn("There are no loaded structures.");
        }
        return structNodes[0];
    }
}
/** Return an object with all struct_conn records read from mmCIF.
 * Return {} if the model comes from another format than mmCIF.
 */
function extractStructConns(model) {
    if (!mmcif_1.MmcifFormat.is(model.sourceData)) {
        console.error('Cannot get struct_conn because source data are not mmCIF.');
        return {};
    }
    var mmcifData = model.sourceData.data;
    var _a = mmcifData.db.struct_conn, id = _a.id, asym1 = _a.ptnr1_label_asym_id, seq1 = _a.ptnr1_label_seq_id, authSeq1 = _a.ptnr1_auth_seq_id, authInsCode1 = _a.pdbx_ptnr1_PDB_ins_code, comp1 = _a.ptnr1_label_comp_id, atom1 = _a.ptnr1_label_atom_id, alt1 = _a.pdbx_ptnr1_label_alt_id, asym2 = _a.ptnr2_label_asym_id, seq2 = _a.ptnr2_label_seq_id, authSeq2 = _a.ptnr2_auth_seq_id, authInsCode2 = _a.pdbx_ptnr2_PDB_ins_code, comp2 = _a.ptnr2_label_comp_id, atom2 = _a.ptnr2_label_atom_id, alt2 = _a.pdbx_ptnr2_label_alt_id, distance = _a.pdbx_dist_value;
    var n = id.rowCount;
    var result = {};
    for (var i = 0; i < n; i++) {
        var conn = {
            id: id.value(i),
            distance: distance.value(i),
            partner1: {
                asymId: asym1.value(i),
                seqId: seq1.valueKind(i) === 0 /* Column.ValueKinds.Present */ ? seq1.value(i) : undefined,
                authSeqId: authSeq1.valueKind(i) === 0 /* Column.ValueKinds.Present */ ? authSeq1.value(i) : undefined,
                insCode: authInsCode1.value(i),
                compId: comp1.value(i),
                atomId: atom1.value(i),
                altId: alt1.value(i),
            },
            partner2: {
                asymId: asym2.value(i),
                seqId: seq2.valueKind(i) === 0 /* Column.ValueKinds.Present */ ? seq2.value(i) : undefined,
                authSeqId: authSeq2.valueKind(i) === 0 /* Column.ValueKinds.Present */ ? authSeq2.value(i) : undefined,
                insCode: authInsCode2.value(i),
                compId: comp2.value(i),
                atomId: atom2.value(i),
                altId: alt2.value(i),
            },
        };
        result[conn.id] = conn;
    }
    return result;
}
/** Return MolScript expression for atoms or residues involved in a struct_conn */
function structConnExpression(conn, by) {
    var core = builder_1.MolScriptBuilder.core, struct = builder_1.MolScriptBuilder.struct;
    var partnerExpressions = [];
    for (var _i = 0, _a = [conn.partner1, conn.partner2]; _i < _a.length; _i++) {
        var partner = _a[_i];
        var propTests = {
            'chain-test': core.rel.eq([struct.atomProperty.macromolecular.label_asym_id(), partner.asymId]),
            'group-by': struct.atomProperty.core.operatorName(),
        };
        if (partner.seqId !== undefined) {
            propTests['residue-test'] = core.rel.eq([struct.atomProperty.macromolecular.label_seq_id(), partner.seqId]);
        }
        else if (partner.authSeqId !== undefined) { // for the case of water and carbohydrates (see 5elb, covale3 vs covale5)
            propTests['residue-test'] = core.logic.and([
                core.rel.eq([struct.atomProperty.macromolecular.auth_seq_id(), partner.authSeqId]),
                core.rel.eq([struct.atomProperty.macromolecular.pdbx_PDB_ins_code(), partner.insCode]),
            ]);
        }
        if (by === 'residues' && partner.altId !== '') {
            propTests['atom-test'] = core.rel.eq([struct.atomProperty.macromolecular.label_alt_id(), partner.altId]);
        }
        if (by === 'atoms') {
            propTests['atom-test'] = core.logic.and([
                core.rel.eq([struct.atomProperty.macromolecular.label_atom_id(), partner.atomId]),
                core.rel.eq([struct.atomProperty.macromolecular.label_alt_id(), partner.altId]),
            ]);
        }
        partnerExpressions.push(struct.filter.first([struct.generator.atomGroups(propTests)]));
    }
    return struct.combinator.merge(partnerExpressions.map(function (e) { return struct.modifier.union([e]); }));
}
/** Create visuals for residues and atoms involved in a struct_conn and zoom on them.
 * Return a promise that resolves to the number of involved atoms which were successfully selected (2, 1, or 0).
 */
function addStructConnInspection(plugin, structNode, conn) {
    var _a, _b, _c, _d;
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var expressionByResidues, expressionByAtoms, update, atomsSelection, atomsVisual, nSelectedAtoms;
        return tslib_1.__generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    expressionByResidues = structConnExpression(conn, 'residues');
                    expressionByAtoms = structConnExpression(conn, 'atoms');
                    update = plugin.build();
                    update.to(structNode).apply(model_1.StructureComponent, { label: "".concat(conn.id, " (residues)"), type: { name: 'expression', params: expressionByResidues } }, { tags: [TAGS.RESIDUE_SEL] }).apply(representation_1.StructureRepresentation3D, RESIDUES_VISUAL_PARAMS, { tags: [TAGS.RESIDUE_REPR] });
                    atomsSelection = update.to(structNode).apply(model_1.StructureComponent, { label: "".concat(conn.id, " (atoms)"), type: { name: 'expression', params: expressionByAtoms } }, { tags: [TAGS.ATOM_SEL] });
                    atomsVisual = update.to(atomsSelection.ref).apply(representation_1.StructureRepresentation3D, ATOMS_VISUAL_PARAMS, { tags: [TAGS.ATOM_REPR] });
                    return [4 /*yield*/, update.commit()];
                case 1:
                    _e.sent();
                    plugin.managers.camera.focusRenderObjects((_a = atomsVisual.selector.data) === null || _a === void 0 ? void 0 : _a.repr.renderObjects, { extraRadius: EXTRA_RADIUS });
                    nSelectedAtoms = (_d = (_c = (_b = atomsSelection.selector.obj) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.elementCount) !== null && _d !== void 0 ? _d : 0;
                    return [2 /*return*/, nSelectedAtoms];
            }
        });
    });
}
/** Remove anything created by `addStructConnInspection` */
function removeAllStructConnInspections(plugin, structNode) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var selNodes, update, _i, selNodes_1, node;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    selNodes = tslib_1.__spreadArray(tslib_1.__spreadArray([], plugin.state.data.selectQ(function (q) { return q.byRef(structNode.transform.ref).subtree().withTag(TAGS.RESIDUE_SEL); }), true), plugin.state.data.selectQ(function (q) { return q.byRef(structNode.transform.ref).subtree().withTag(TAGS.ATOM_SEL); }), true);
                    update = plugin.build();
                    for (_i = 0, selNodes_1 = selNodes; _i < selNodes_1.length; _i++) {
                        node = selNodes_1[_i];
                        update.delete(node);
                    }
                    return [4 /*yield*/, update.commit()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Hide all carbohydrate SNFG visuals */
function hideSnfgNodes(plugin, structNode) {
    var snfgNodes = plugin.state.data.selectQ(function (q) { return q.byRef(structNode.transform.ref).subtree().withTag('branched-snfg-3d'); });
    for (var _i = 0, snfgNodes_1 = snfgNodes; _i < snfgNodes_1.length; _i++) {
        var node = snfgNodes_1[_i];
        (0, state_1.setSubtreeVisibility)(plugin.state.data, node.transform.ref, true); // true means hidden
    }
}
/** Make visible all carbohydrate SNFG visuals that have been hidden by `hideSnfgNodes` */
function unhideSnfgNodes(plugin, structNode) {
    var snfgNodes = plugin.state.data.selectQ(function (q) { return q.byRef(structNode.transform.ref).subtree().withTag('branched-snfg-3d'); });
    for (var _i = 0, snfgNodes_2 = snfgNodes; _i < snfgNodes_2.length; _i++) {
        var node = snfgNodes_2[_i];
        try {
            (0, state_1.setSubtreeVisibility)(plugin.state.data, node.transform.ref, false); // false means visible
        }
        catch (_a) {
            // this is OK, the node has been removed
        }
    }
}
