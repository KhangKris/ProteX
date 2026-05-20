"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbNcbrPartialChargesPropertyProvider = exports.hasPartialChargesCategories = void 0;
var param_definition_1 = require("../../../mol-util/param-definition");
var mmcif_1 = require("../../../mol-model-formats/structure/mmcif");
var custom_property_1 = require("../../../mol-model/custom-property");
var custom_model_property_1 = require("../../../mol-model-props/common/custom-model-property");
var array_1 = require("../../../mol-util/array");
var PartialChargesPropertyParams = {
    typeId: param_definition_1.ParamDefinition.Select(0, [[0, '0']]),
};
var DefaultPartialChargesPropertyParams = param_definition_1.ParamDefinition.clone(PartialChargesPropertyParams);
function getParams(model) {
    var _a, _b;
    return (_b = (_a = getData(model).value) === null || _a === void 0 ? void 0 : _a.params) !== null && _b !== void 0 ? _b : DefaultPartialChargesPropertyParams;
}
var PropertyKey = 'sb-ncbr-partial-charges-property-data';
function getData(model) {
    if (PropertyKey in model._staticPropertyData) {
        return model._staticPropertyData[PropertyKey];
    }
    var data;
    if (!exports.SbNcbrPartialChargesPropertyProvider.isApplicable(model)) {
        data = { value: undefined };
    }
    else {
        var typeIdToMethod = getTypeIdToMethod(model);
        var typeIdToAtomIdToCharge = getTypeIdToAtomIdToCharge(model);
        var typeIdToResidueToCharge = getTypeIdToResidueIdToCharge(model, typeIdToAtomIdToCharge);
        var maxAbsoluteAtomCharges = getMaxAbsoluteCharges(typeIdToAtomIdToCharge);
        var maxAbsoluteResidueCharges = getMaxAbsoluteCharges(typeIdToResidueToCharge);
        var maxAbsoluteAtomChargeAll = getMaxAbsoluteAtomChargeAll(maxAbsoluteAtomCharges, maxAbsoluteResidueCharges);
        var options = Array.from(typeIdToMethod.entries()).map(function (_a) {
            var typeId = _a[0], method = _a[1];
            return [typeId, method];
        });
        var params = {
            typeId: param_definition_1.ParamDefinition.Select(1, options),
        };
        data = {
            value: {
                typeIdToMethod: typeIdToMethod,
                typeIdToAtomIdToCharge: typeIdToAtomIdToCharge,
                typeIdToResidueToCharge: typeIdToResidueToCharge,
                maxAbsoluteAtomCharges: maxAbsoluteAtomCharges,
                maxAbsoluteResidueCharges: maxAbsoluteResidueCharges,
                maxAbsoluteAtomChargeAll: maxAbsoluteAtomChargeAll,
                params: params,
            },
        };
    }
    model._staticPropertyData[PropertyKey] = data;
    return data;
}
function getTypeIdToMethod(model) {
    var typeIdToMethod = new Map();
    var sourceData = model.sourceData;
    var rowCount = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges_meta.rowCount;
    var typeIds = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges_meta.getField('id');
    var methods = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges_meta.getField('method');
    if (!typeIds || !methods) {
        return typeIdToMethod;
    }
    for (var i = 0; i < rowCount; ++i) {
        var typeId = typeIds.int(i);
        var method = methods.str(i);
        typeIdToMethod.set(typeId, method);
    }
    return typeIdToMethod;
}
function getTypeIdToAtomIdToCharge(model) {
    var _a;
    var atomIdToCharge = new Map();
    var sourceData = model.sourceData;
    var rowCount = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges.rowCount;
    var typeIds = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges.getField('type_id');
    var atomIds = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges.getField('atom_id');
    var charges = sourceData.data.frame.categories.sb_ncbr_partial_atomic_charges.getField('charge');
    if (!typeIds || !atomIds || !charges)
        return atomIdToCharge;
    for (var i = 0; i < rowCount; ++i) {
        var typeId = typeIds.int(i);
        var atomId = atomIds.int(i);
        var charge = charges.float(i);
        if (!atomIdToCharge.has(typeId))
            atomIdToCharge.set(typeId, new Map());
        (_a = atomIdToCharge.get(typeId)) === null || _a === void 0 ? void 0 : _a.set(atomId, charge);
    }
    return atomIdToCharge;
}
function getTypeIdToResidueIdToCharge(model, typeIdToAtomIdToCharge) {
    var _a = model.atomicHierarchy.residueAtomSegments, offsets = _a.offsets, count = _a.count;
    var atomIds = model.atomicConformation.atomId;
    var residueToCharge = new Map();
    typeIdToAtomIdToCharge.forEach(function (atomIdToCharge, typeId) {
        if (!residueToCharge.has(typeId))
            residueToCharge.set(typeId, new Map());
        var residueCharges = residueToCharge.get(typeId);
        for (var rI = 0; rI < count; rI++) {
            var charge = 0;
            for (var aI = offsets[rI], _aI = offsets[rI + 1]; aI < _aI; aI++) {
                var atom_id = atomIds.value(aI);
                charge += atomIdToCharge.get(atom_id) || 0;
            }
            for (var aI = offsets[rI], _aI = offsets[rI + 1]; aI < _aI; aI++) {
                var atom_id = atomIds.value(aI);
                residueCharges.set(atom_id, charge);
            }
        }
    });
    return residueToCharge;
}
function getMaxAbsoluteCharges(typeIdToCharge) {
    var maxAbsoluteCharges = new Map();
    typeIdToCharge.forEach(function (idToCharge, typeId) {
        var charges = Array.from(idToCharge.values());
        var _a = (0, array_1.arrayMinMax)(charges), min = _a[0], max = _a[1];
        var bound = Math.max(Math.abs(min), max);
        maxAbsoluteCharges.set(typeId, bound);
    });
    return maxAbsoluteCharges;
}
function getMaxAbsoluteAtomChargeAll(maxAbsoluteAtomCharges, maxAbsoluteResidueCharges) {
    var maxAbsoluteCharge = 0;
    maxAbsoluteAtomCharges.forEach(function (_, typeId) {
        var maxCharge = maxAbsoluteAtomCharges.get(typeId) || 0;
        if (maxCharge > maxAbsoluteCharge)
            maxAbsoluteCharge = maxCharge;
    });
    maxAbsoluteResidueCharges.forEach(function (_, typeId) {
        var maxCharge = maxAbsoluteResidueCharges.get(typeId) || 0;
        if (maxCharge > maxAbsoluteCharge)
            maxAbsoluteCharge = maxCharge;
    });
    return maxAbsoluteCharge;
}
function hasPartialChargesCategories(model) {
    if (!model || !mmcif_1.MmcifFormat.is(model.sourceData))
        return false;
    var categories = model.sourceData.data.frame.categories;
    return ('atom_site' in categories &&
        'sb_ncbr_partial_atomic_charges' in categories &&
        'sb_ncbr_partial_atomic_charges_meta' in categories);
}
exports.hasPartialChargesCategories = hasPartialChargesCategories;
exports.SbNcbrPartialChargesPropertyProvider = custom_model_property_1.CustomModelProperty.createProvider({
    label: 'SB NCBR Partial Charges Property Provider',
    descriptor: (0, custom_property_1.CustomPropertyDescriptor)({
        name: 'sb-ncbr-partial-charges-property-provider',
    }),
    type: 'static',
    defaultParams: DefaultPartialChargesPropertyParams,
    getParams: function (data) { return getParams(data); },
    isApplicable: function (model) { return hasPartialChargesCategories(model); },
    obtain: function (_ctx, model) { return Promise.resolve(getData(model)); },
});
