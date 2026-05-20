"use strict";
/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemicalComponentPreset = exports.ChemicalCompontentTrajectoryHierarchyPreset = void 0;
var tslib_1 = require("tslib");
var param_definition_1 = require("../../../mol-util/param-definition");
var mol_state_1 = require("../../../mol-state");
var transforms_1 = require("../../../mol-plugin-state/transforms");
var representation_preset_1 = require("../../../mol-plugin-state/builder/structure/representation-preset");
var mmcif_1 = require("../../../mol-model-formats/structure/mmcif");
var minimize_rmsd_1 = require("../../../mol-math/linear-algebra/3d/minimize-rmsd");
var set_1 = require("../../../mol-util/set");
var hierarchy_preset_1 = require("../../../mol-plugin-state/builder/structure/hierarchy-preset");
var string_1 = require("../../../mol-util/string");
var CCDParams = function (a, plugin) { return (tslib_1.__assign({ representationPresetParams: param_definition_1.ParamDefinition.Optional(param_definition_1.ParamDefinition.Group(representation_preset_1.StructureRepresentationPresetProvider.CommonParams)), showOriginalCoordinates: param_definition_1.ParamDefinition.Optional(param_definition_1.ParamDefinition.Boolean(true, { description: "Show original coordinates for 'model' and 'ideal' structure and do not align them." })), shownCoordinateType: param_definition_1.ParamDefinition.Select('ideal', param_definition_1.ParamDefinition.arrayToOptions(['ideal', 'model', 'both']), { description: "What coordinate sets are visible." }), aromaticBonds: param_definition_1.ParamDefinition.Boolean(false, { description: 'Display aromatic bonds with dashes' }) }, hierarchy_preset_1.TrajectoryHierarchyPresetProvider.CommonParams(a, plugin))); };
exports.ChemicalCompontentTrajectoryHierarchyPreset = (0, hierarchy_preset_1.TrajectoryHierarchyPresetProvider)({
    id: 'preset-trajectory-ccd',
    display: {
        name: 'Chemical Component', group: 'Preset',
        description: 'Shows molecules from the Chemical Component Dictionary.'
    },
    isApplicable: function (o) {
        return mmcif_1.CCDFormat.is(o.data.representative.sourceData);
    },
    params: CCDParams,
    apply: function (trajectory, params, plugin) {
        var _a, _b;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var tr, builder, idealModel, idealModelProperties, idealStructure, idealStructureProperties, representationPreset, representationPresetParams, coordinateType, modelModel, modelModelProperties, modelStructure, modelStructureProperties, _c, a, b, _d, bTransform, rmsd;
            return tslib_1.__generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        tr = (_b = (_a = mol_state_1.StateObjectRef.resolveAndCheck(plugin.state.data, trajectory)) === null || _a === void 0 ? void 0 : _a.obj) === null || _b === void 0 ? void 0 : _b.data;
                        if (!tr)
                            return [2 /*return*/, {}];
                        builder = plugin.builders.structure;
                        return [4 /*yield*/, builder.createModel(trajectory, { modelIndex: 0 })];
                    case 1:
                        idealModel = _e.sent();
                        return [4 /*yield*/, builder.insertModelProperties(idealModel, params.modelProperties, { isCollapsed: true })];
                    case 2:
                        idealModelProperties = _e.sent();
                        return [4 /*yield*/, builder.createStructure(idealModelProperties || idealModel, { name: 'model', params: {} })];
                    case 3:
                        idealStructure = _e.sent();
                        return [4 /*yield*/, builder.insertStructureProperties(idealStructure, params.structureProperties)];
                    case 4:
                        idealStructureProperties = _e.sent();
                        representationPreset = params.representationPreset || exports.ChemicalComponentPreset.id;
                        representationPresetParams = params.representationPresetParams || {};
                        if (representationPresetParams.ignoreHydrogens === undefined)
                            representationPresetParams.ignoreHydrogens = true;
                        if (!(tr.frameCount !== 2)) return [3 /*break*/, 6];
                        coordinateType = mmcif_1.CCDFormat.CoordinateType.get(idealModel.obj.data);
                        return [4 /*yield*/, builder.representation.applyPreset(idealStructureProperties, representationPreset, tslib_1.__assign(tslib_1.__assign({}, representationPresetParams), { coordinateType: coordinateType }))];
                    case 5:
                        _e.sent();
                        return [2 /*return*/, { models: [idealModel], structures: [idealStructure] }];
                    case 6: return [4 /*yield*/, builder.createModel(trajectory, { modelIndex: 1 })];
                    case 7:
                        modelModel = _e.sent();
                        return [4 /*yield*/, builder.insertModelProperties(modelModel, params.modelProperties, { isCollapsed: true })];
                    case 8:
                        modelModelProperties = _e.sent();
                        return [4 /*yield*/, builder.createStructure(modelModelProperties || modelModel, { name: 'model', params: {} })];
                    case 9:
                        modelStructure = _e.sent();
                        return [4 /*yield*/, builder.insertStructureProperties(modelStructure, params.structureProperties)];
                    case 10:
                        modelStructureProperties = _e.sent();
                        if (!!params.showOriginalCoordinates) return [3 /*break*/, 13];
                        _c = getPositionTables(idealStructure.obj.data, modelStructure.obj.data), a = _c[0], b = _c[1];
                        if (!!a) return [3 /*break*/, 11];
                        plugin.log.warn("Cannot align chemical components whose atom sets are disjoint.");
                        return [3 /*break*/, 13];
                    case 11:
                        _d = minimize_rmsd_1.MinimizeRmsd.compute({ a: a, b: b }), bTransform = _d.bTransform, rmsd = _d.rmsd;
                        return [4 /*yield*/, transform(plugin, modelStructure.cell, bTransform)];
                    case 12:
                        _e.sent();
                        plugin.log.info("Superposed [model] and [ideal] with RMSD ".concat(rmsd.toFixed(2), "."));
                        _e.label = 13;
                    case 13: return [4 /*yield*/, builder.representation.applyPreset(idealStructureProperties, representationPreset, tslib_1.__assign(tslib_1.__assign({}, representationPresetParams), { aromaticBonds: params.aromaticBonds, coordinateType: 'ideal', isHidden: params.shownCoordinateType === 'model' }))];
                    case 14:
                        _e.sent();
                        return [4 /*yield*/, builder.representation.applyPreset(modelStructureProperties, representationPreset, tslib_1.__assign(tslib_1.__assign({}, representationPresetParams), { aromaticBonds: params.aromaticBonds, coordinateType: 'model', isHidden: params.shownCoordinateType === 'ideal' }))];
                    case 15:
                        _e.sent();
                        return [2 /*return*/, { models: [idealModel, modelModel], structures: [idealStructure, modelStructure] }];
                }
            });
        });
    }
});
function getPositionTables(s1, s2) {
    var m1 = getAtomIdSerialMap(s1);
    var m2 = getAtomIdSerialMap(s2);
    var intersecting = set_1.SetUtils.intersection(new Set(m1.keys()), new Set(m2.keys()));
    var ret = [
        minimize_rmsd_1.MinimizeRmsd.Positions.empty(intersecting.size),
        minimize_rmsd_1.MinimizeRmsd.Positions.empty(intersecting.size)
    ];
    var o = 0;
    intersecting.forEach(function (k) {
        ret[0].x[o] = s1.model.atomicConformation.x[m1.get(k)];
        ret[0].y[o] = s1.model.atomicConformation.y[m1.get(k)];
        ret[0].z[o] = s1.model.atomicConformation.z[m1.get(k)];
        ret[1].x[o] = s2.model.atomicConformation.x[m2.get(k)];
        ret[1].y[o] = s2.model.atomicConformation.y[m2.get(k)];
        ret[1].z[o] = s2.model.atomicConformation.z[m2.get(k)];
        o++;
    });
    return ret;
}
function getAtomIdSerialMap(structure) {
    var map = new Map();
    var label_atom_id = structure.model.atomicHierarchy.atoms.label_atom_id;
    for (var i = 0, il = label_atom_id.rowCount; i < il; ++i) {
        var id = label_atom_id.value(i);
        if (!map.has(id))
            map.set(id, map.size);
    }
    return map;
}
function transform(plugin, s, matrix) {
    var b = plugin.state.data.build().to(s)
        .insert(transforms_1.StateTransforms.Model.TransformStructureConformation, { transform: { name: 'matrix', params: { data: matrix, transpose: false } } });
    return plugin.runTask(plugin.state.data.updateTree(b));
}
exports.ChemicalComponentPreset = (0, representation_preset_1.StructureRepresentationPresetProvider)({
    id: 'preset-structure-representation-chemical-component',
    display: {
        name: 'Chemical Component', group: 'Miscellaneous',
        description: "Show 'Ideal' and 'Model' coordinates of chemical components."
    },
    isApplicable: function (o) {
        return mmcif_1.CCDFormat.is(o.data.model.sourceData);
    },
    params: function () { return (tslib_1.__assign(tslib_1.__assign({}, representation_preset_1.StructureRepresentationPresetProvider.CommonParams), { aromaticBonds: param_definition_1.ParamDefinition.Boolean(true), coordinateType: param_definition_1.ParamDefinition.Select('ideal', param_definition_1.ParamDefinition.arrayToOptions(['ideal', 'model'])), isHidden: param_definition_1.ParamDefinition.Boolean(false) })); },
    apply: function (ref, params, plugin) {
        var _a, _b, _c, _d, _e, _f;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var structureCell, aromaticBonds, coordinateType, isHidden, components, _g, structure, _h, update, builder, typeParams, representations;
            var _j, _k;
            return tslib_1.__generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        structureCell = mol_state_1.StateObjectRef.resolveAndCheck(plugin.state.data, ref);
                        if (!structureCell)
                            return [2 /*return*/, {}];
                        aromaticBonds = params.aromaticBonds, coordinateType = params.coordinateType, isHidden = params.isHidden;
                        _j = {};
                        _g = coordinateType;
                        return [4 /*yield*/, (0, representation_preset_1.presetStaticComponent)(plugin, structureCell, 'all', { label: (0, string_1.capitalize)(coordinateType), tags: [coordinateType] })];
                    case 1:
                        components = (_j[_g] = _l.sent(),
                            _j);
                        structure = structureCell.obj.data;
                        _h = representation_preset_1.StructureRepresentationPresetProvider.reprBuilder(plugin, params), update = _h.update, builder = _h.builder, typeParams = _h.typeParams;
                        representations = (_k = {},
                            _k[coordinateType] = builder.buildRepresentation(update, components[coordinateType], { type: 'ball-and-stick', typeParams: tslib_1.__assign(tslib_1.__assign({}, typeParams), { aromaticBonds: aromaticBonds }) }, { initialState: { isHidden: isHidden } }),
                            _k);
                        // sync UI state
                        if (((_b = (_a = components[coordinateType]) === null || _a === void 0 ? void 0 : _a.cell) === null || _b === void 0 ? void 0 : _b.state) && isHidden) {
                            mol_state_1.StateTransform.assignState(components[coordinateType].cell.state, { isHidden: isHidden });
                        }
                        return [4 /*yield*/, update.commit({ revertOnError: true })];
                    case 2:
                        _l.sent();
                        return [4 /*yield*/, representation_preset_1.StructureRepresentationPresetProvider.updateFocusRepr(plugin, structure, (_d = (_c = params.theme) === null || _c === void 0 ? void 0 : _c.focus) === null || _d === void 0 ? void 0 : _d.name, (_f = (_e = params.theme) === null || _e === void 0 ? void 0 : _e.focus) === null || _f === void 0 ? void 0 : _f.params)];
                    case 3:
                        _l.sent();
                        return [2 /*return*/, { components: components, representations: representations }];
                }
            });
        });
    }
});
