import { __assign, __awaiter, __generator } from "tslib";
import { PresetStructureRepresentations, StructureRepresentationPresetProvider, } from '../../../mol-plugin-state/builder/structure/representation-preset';
import { StateObjectRef } from '../../../mol-state';
import { SbNcbrPartialChargesPropertyProvider } from './property';
import { SbNcbrPartialChargesColorThemeProvider } from './color';
export var SbNcbrPartialChargesPreset = StructureRepresentationPresetProvider({
    id: 'sb-ncbr-partial-charges-preset',
    display: {
        name: 'SB NCBR Partial Charges',
        group: 'Annotation',
        description: 'Color atoms and residues based on their partial charge.',
    },
    isApplicable: function (a) {
        return !!a.data.models.some(function (m) { return SbNcbrPartialChargesPropertyProvider.isApplicable(m); });
    },
    params: function () { return StructureRepresentationPresetProvider.CommonParams; },
    apply: function (ref, params, plugin) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var structureCell, structure, colorTheme;
            return __generator(this, function (_b) {
                structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
                structure = (_a = structureCell === null || structureCell === void 0 ? void 0 : structureCell.obj) === null || _a === void 0 ? void 0 : _a.data;
                if (!structureCell || !structure)
                    return [2 /*return*/, {}];
                colorTheme = SbNcbrPartialChargesColorThemeProvider.name;
                return [2 /*return*/, PresetStructureRepresentations.auto.apply(ref, __assign(__assign({}, params), { theme: { globalName: colorTheme, focus: { name: colorTheme, params: { chargeType: 'atom' } } } }), plugin)];
            });
        });
    },
});
