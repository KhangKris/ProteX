"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbNcbrPartialChargesPreset = void 0;
var tslib_1 = require("tslib");
var representation_preset_1 = require("../../../mol-plugin-state/builder/structure/representation-preset");
var mol_state_1 = require("../../../mol-state");
var property_1 = require("./property");
var color_1 = require("./color");
exports.SbNcbrPartialChargesPreset = (0, representation_preset_1.StructureRepresentationPresetProvider)({
    id: 'sb-ncbr-partial-charges-preset',
    display: {
        name: 'SB NCBR Partial Charges',
        group: 'Annotation',
        description: 'Color atoms and residues based on their partial charge.',
    },
    isApplicable: function (a) {
        return !!a.data.models.some(function (m) { return property_1.SbNcbrPartialChargesPropertyProvider.isApplicable(m); });
    },
    params: function () { return representation_preset_1.StructureRepresentationPresetProvider.CommonParams; },
    apply: function (ref, params, plugin) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var structureCell, structure, colorTheme;
            return tslib_1.__generator(this, function (_b) {
                structureCell = mol_state_1.StateObjectRef.resolveAndCheck(plugin.state.data, ref);
                structure = (_a = structureCell === null || structureCell === void 0 ? void 0 : structureCell.obj) === null || _a === void 0 ? void 0 : _a.data;
                if (!structureCell || !structure)
                    return [2 /*return*/, {}];
                colorTheme = color_1.SbNcbrPartialChargesColorThemeProvider.name;
                return [2 /*return*/, representation_preset_1.PresetStructureRepresentations.auto.apply(ref, tslib_1.__assign(tslib_1.__assign({}, params), { theme: { globalName: colorTheme, focus: { name: colorTheme, params: { chargeType: 'atom' } } } }), plugin)];
            });
        });
    },
});
