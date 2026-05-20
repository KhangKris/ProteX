"use strict";
/**
 * Copyright (c) 2017-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trajectoryFromCCD = exports.CCDFormat = exports.trajectoryFromMmCIF = exports.MmcifFormat = void 0;
var tslib_1 = require("tslib");
var model_1 = require("../../mol-model/structure/model/model");
var mol_task_1 = require("../../mol-task");
var cif_1 = require("../../mol-io/reader/cif");
var parser_1 = require("./basic/parser");
var symmetry_1 = require("./property/symmetry");
var secondary_structure_1 = require("./property/secondary-structure");
var db_1 = require("../../mol-data/db");
var anisotropic_1 = require("./property/anisotropic");
var chem_comp_1 = require("./property/bonds/chem_comp");
var struct_conn_1 = require("./property/bonds/struct_conn");
var structure_1 = require("../../mol-model/structure");
var global_transform_1 = require("../../mol-model/structure/model/properties/global-transform");
var schema_1 = require("./basic/schema");
var entity_1 = require("./common/entity");
var component_1 = require("./common/component");
function modelSymmetryFromMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return;
    return symmetry_1.ModelSymmetry.fromData(model.sourceData.data.db);
}
symmetry_1.ModelSymmetry.Provider.formatRegistry.add('mmCIF', modelSymmetryFromMmcif);
function secondaryStructureFromMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return;
    var _a = model.sourceData.data.db, struct_conf = _a.struct_conf, struct_sheet_range = _a.struct_sheet_range;
    return secondary_structure_1.ModelSecondaryStructure.fromStruct(struct_conf, struct_sheet_range, model.atomicHierarchy);
}
secondary_structure_1.ModelSecondaryStructure.Provider.formatRegistry.add('mmCIF', secondaryStructureFromMmcif);
function atomSiteAnisotropFromMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return;
    var atom_site_anisotrop = model.sourceData.data.db.atom_site_anisotrop;
    var data = db_1.Table.ofColumns(anisotropic_1.AtomSiteAnisotrop.Schema, atom_site_anisotrop);
    var elementToAnsiotrop = anisotropic_1.AtomSiteAnisotrop.getElementToAnsiotrop(model.atomicConformation.atomId, atom_site_anisotrop.id);
    return { data: data, elementToAnsiotrop: elementToAnsiotrop };
}
function atomSiteAnisotropApplicableMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return false;
    return model.sourceData.data.db.atom_site_anisotrop.U.isDefined;
}
anisotropic_1.AtomSiteAnisotrop.Provider.formatRegistry.add('mmCIF', atomSiteAnisotropFromMmcif, atomSiteAnisotropApplicableMmcif);
function componentBondFromMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return;
    var chem_comp_bond = model.sourceData.data.db.chem_comp_bond;
    if (chem_comp_bond._rowCount === 0)
        return;
    return {
        data: chem_comp_bond,
        entries: chem_comp_1.ComponentBond.getEntriesFromChemCompBond(chem_comp_bond)
    };
}
chem_comp_1.ComponentBond.Provider.formatRegistry.add('mmCIF', componentBondFromMmcif);
function structConnFromMmcif(model) {
    if (!MmcifFormat.is(model.sourceData))
        return;
    var struct_conn = model.sourceData.data.db.struct_conn;
    if (struct_conn._rowCount === 0)
        return;
    var entries = struct_conn_1.StructConn.getEntriesFromStructConn(struct_conn, model);
    return {
        data: struct_conn,
        byAtomIndex: struct_conn_1.StructConn.getAtomIndexFromEntries(entries),
        entries: entries,
    };
}
struct_conn_1.StructConn.Provider.formatRegistry.add('mmCIF', structConnFromMmcif);
global_transform_1.GlobalModelTransformInfo.Provider.formatRegistry.add('mmCIF', global_transform_1.GlobalModelTransformInfo.fromMmCif, global_transform_1.GlobalModelTransformInfo.hasData);
var MmcifFormat;
(function (MmcifFormat) {
    function is(x) {
        return (x === null || x === void 0 ? void 0 : x.kind) === 'mmCIF';
    }
    MmcifFormat.is = is;
    function fromFrame(frame, db, source, file) {
        if (!db)
            db = cif_1.CIF.schema.mmCIF(frame);
        return { kind: 'mmCIF', name: db._name, data: { db: db, file: file, frame: frame, source: source } };
    }
    MmcifFormat.fromFrame = fromFrame;
})(MmcifFormat || (exports.MmcifFormat = MmcifFormat = {}));
function trajectoryFromMmCIF(frame, file) {
    var format = MmcifFormat.fromFrame(frame, undefined, undefined, file);
    var basic = (0, schema_1.createBasic)(format.data.db, true);
    return mol_task_1.Task.create('Create mmCIF Model', function (ctx) { return (0, parser_1.createModels)(basic, format, ctx); });
}
exports.trajectoryFromMmCIF = trajectoryFromMmCIF;
var CCDFormat;
(function (CCDFormat) {
    var CoordinateTypeProp = '__CcdCoordinateType__';
    CCDFormat.CoordinateType = {
        get: function (model) {
            return model._staticPropertyData[CoordinateTypeProp];
        },
        set: function (model, type) {
            return model._staticPropertyData[CoordinateTypeProp] = type;
        }
    };
    function is(x) {
        return (x === null || x === void 0 ? void 0 : x.kind) === 'CCD';
    }
    CCDFormat.is = is;
    function fromFrame(frame, db) {
        if (!db)
            db = cif_1.CIF.schema.CCD(frame);
        return { kind: 'CCD', name: db._name, data: { db: db, frame: frame } };
    }
    CCDFormat.fromFrame = fromFrame;
})(CCDFormat || (exports.CCDFormat = CCDFormat = {}));
function trajectoryFromCCD(frame) {
    var format = CCDFormat.fromFrame(frame);
    return mol_task_1.Task.create('Create CCD Models', function (ctx) { return createCcdModels(format.data.db, CCDFormat.fromFrame(frame), ctx); });
}
exports.trajectoryFromCCD = trajectoryFromCCD;
function createCcdModels(data, format, ctx) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var ideal, model, models, i, il;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createCcdModel(data, format, { coordinateType: 'ideal', cartn_x: 'pdbx_model_Cartn_x_ideal', cartn_y: 'pdbx_model_Cartn_y_ideal', cartn_z: 'pdbx_model_Cartn_z_ideal' }, ctx)];
                case 1:
                    ideal = _a.sent();
                    return [4 /*yield*/, createCcdModel(data, format, { coordinateType: 'model', cartn_x: 'model_Cartn_x', cartn_y: 'model_Cartn_y', cartn_z: 'model_Cartn_z' }, ctx)];
                case 2:
                    model = _a.sent();
                    models = [];
                    if (ideal)
                        models.push(ideal);
                    if (model)
                        models.push(model);
                    for (i = 0, il = models.length; i < il; ++i) {
                        model_1.Model.TrajectoryInfo.set(models[i], { index: i, size: models.length });
                    }
                    return [2 /*return*/, new structure_1.ArrayTrajectory(models)];
            }
        });
    });
}
function createCcdModel(data, format, props, ctx) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var chem_comp, chem_comp_atom, chem_comp_bond, coordinateType, cartn_x, cartn_y, cartn_z, name, id, atom_id, charge, comp_id, pdbx_ordinal, type_symbol, atomCount, filteredRows, i, filteredRowCount, A, seq_id, entity_id, occupancy, model_num, filteredAtomId, filteredCompId, filteredX, filteredY, filteredZ, filteredId, filteredTypeSymbol, filteredCharge, model_atom_site, entityBuilder, componentBuilder, basicModel, models, first, entries;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chem_comp = data.chem_comp, chem_comp_atom = data.chem_comp_atom, chem_comp_bond = data.chem_comp_bond;
                    coordinateType = props.coordinateType, cartn_x = props.cartn_x, cartn_y = props.cartn_y, cartn_z = props.cartn_z;
                    name = chem_comp.name.value(0);
                    id = chem_comp.id.value(0);
                    atom_id = chem_comp_atom.atom_id, charge = chem_comp_atom.charge, comp_id = chem_comp_atom.comp_id, pdbx_ordinal = chem_comp_atom.pdbx_ordinal, type_symbol = chem_comp_atom.type_symbol;
                    atomCount = chem_comp_atom._rowCount;
                    filteredRows = [];
                    for (i = 0; i < atomCount; i++) {
                        if (chem_comp_atom[cartn_x].valueKind(i) > 0)
                            continue;
                        filteredRows[filteredRows.length] = i;
                    }
                    filteredRowCount = filteredRows.length;
                    A = db_1.Column.ofConst('A', filteredRowCount, db_1.Column.Schema.str);
                    seq_id = db_1.Column.ofConst(1, filteredRowCount, db_1.Column.Schema.int);
                    entity_id = db_1.Column.ofConst('1', filteredRowCount, db_1.Column.Schema.str);
                    occupancy = db_1.Column.ofConst(1, filteredRowCount, db_1.Column.Schema.float);
                    model_num = db_1.Column.ofConst(1, filteredRowCount, db_1.Column.Schema.int);
                    filteredAtomId = db_1.Column.view(atom_id, filteredRows);
                    filteredCompId = db_1.Column.view(comp_id, filteredRows);
                    filteredX = db_1.Column.view(chem_comp_atom[cartn_x], filteredRows);
                    filteredY = db_1.Column.view(chem_comp_atom[cartn_y], filteredRows);
                    filteredZ = db_1.Column.view(chem_comp_atom[cartn_z], filteredRows);
                    filteredId = db_1.Column.view(pdbx_ordinal, filteredRows);
                    filteredTypeSymbol = db_1.Column.view(type_symbol, filteredRows);
                    filteredCharge = db_1.Column.view(charge, filteredRows);
                    model_atom_site = db_1.Table.ofPartialColumns(schema_1.BasicSchema.atom_site, {
                        auth_asym_id: A,
                        auth_atom_id: filteredAtomId,
                        auth_comp_id: filteredCompId,
                        auth_seq_id: seq_id,
                        Cartn_x: filteredX,
                        Cartn_y: filteredY,
                        Cartn_z: filteredZ,
                        id: filteredId,
                        label_asym_id: A,
                        label_atom_id: filteredAtomId,
                        label_comp_id: filteredCompId,
                        label_seq_id: seq_id,
                        label_entity_id: entity_id,
                        occupancy: occupancy,
                        type_symbol: filteredTypeSymbol,
                        pdbx_PDB_model_num: model_num,
                        pdbx_formal_charge: filteredCharge
                    }, filteredRowCount);
                    entityBuilder = new entity_1.EntityBuilder();
                    entityBuilder.setNames([[id, "".concat(name, " (").concat(coordinateType, ")")]]);
                    entityBuilder.getEntityId(id, 0 /* MoleculeType.Unknown */, 'A');
                    componentBuilder = new component_1.ComponentBuilder(seq_id, type_symbol);
                    componentBuilder.setNames([[id, "".concat(name, " (").concat(coordinateType, ")")]]);
                    componentBuilder.add(id, 0);
                    basicModel = (0, schema_1.createBasic)({
                        entity: entityBuilder.getEntityTable(),
                        chem_comp: componentBuilder.getChemCompTable(),
                        atom_site: model_atom_site
                    });
                    return [4 /*yield*/, (0, parser_1.createModels)(basicModel, format, ctx)];
                case 1:
                    models = _a.sent();
                    // all ideal or model coordinates might be absent
                    if (!models.representative)
                        return [2 /*return*/];
                    first = models.representative;
                    entries = chem_comp_1.ComponentBond.getEntriesFromChemCompBond(chem_comp_bond);
                    chem_comp_1.ComponentBond.Provider.set(first, { data: chem_comp_bond, entries: entries });
                    CCDFormat.CoordinateType.set(first, coordinateType);
                    return [2 /*return*/, models.representative];
            }
        });
    });
}
