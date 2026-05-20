"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbNcbrPartialChargesColorThemeProvider = exports.PartialChargesColorTheme = exports.getPartialChargesThemeParams = exports.PartialChargesThemeParams = void 0;
var structure_1 = require("../../../mol-model/structure");
var color_1 = require("../../../mol-theme/color");
var color_2 = require("../../../mol-util/color");
var param_definition_1 = require("../../../mol-util/param-definition");
var property_1 = require("./property");
var Colors = {
    Bond: (0, color_2.Color)(0xffffff),
    Error: (0, color_2.Color)(0x00ff00),
    MissingCharge: (0, color_2.Color)(0xffffff),
    Negative: (0, color_2.Color)(0xff0000),
    Zero: (0, color_2.Color)(0xffffff),
    Positive: (0, color_2.Color)(0x0000ff),
    getColor: function (charge, maxCharge) {
        if (charge === 0)
            return Colors.Zero;
        if (charge <= -maxCharge)
            return Colors.Negative;
        if (charge >= maxCharge)
            return Colors.Positive;
        var t = maxCharge !== 0 ? Math.abs(charge) / maxCharge : 1;
        var endColor = charge < 0 ? Colors.Negative : Colors.Positive;
        return color_2.Color.interpolate(Colors.Zero, endColor, t);
    },
};
exports.PartialChargesThemeParams = {
    maxAbsoluteCharge: param_definition_1.ParamDefinition.Numeric(0, { min: 0 }, {
        label: 'Charge Range',
    }),
    absolute: param_definition_1.ParamDefinition.Boolean(false, { isHidden: false, label: 'Use Range' }),
    chargeType: param_definition_1.ParamDefinition.Select('residue', [
        ['atom', 'Atom charges'],
        ['residue', 'Residue charges'],
    ], { isHidden: false }),
};
function getPartialChargesThemeParams() {
    return param_definition_1.ParamDefinition.clone(exports.PartialChargesThemeParams);
}
exports.getPartialChargesThemeParams = getPartialChargesThemeParams;
function PartialChargesColorTheme(ctx, props) {
    var _a, _b;
    var model = (_a = ctx.structure) === null || _a === void 0 ? void 0 : _a.models[0];
    if (!model) {
        throw new Error('No model found');
    }
    var data = property_1.SbNcbrPartialChargesPropertyProvider.get(model).value;
    if (!data) {
        throw new Error('No partial charges data found');
    }
    var absolute = props.absolute, chargeType = props.chargeType;
    var typeIdToAtomIdToCharge = data.typeIdToAtomIdToCharge, typeIdToResidueToCharge = data.typeIdToResidueToCharge, maxAbsoluteAtomCharges = data.maxAbsoluteAtomCharges, maxAbsoluteResidueCharges = data.maxAbsoluteResidueCharges;
    var typeId = property_1.SbNcbrPartialChargesPropertyProvider.props(model).typeId;
    var atomToCharge = typeIdToAtomIdToCharge.get(typeId);
    var residueToCharge = typeIdToResidueToCharge.get(typeId);
    var maxCharge = 0;
    if (absolute) {
        maxCharge = props.maxAbsoluteCharge < 0 ? 0 : props.maxAbsoluteCharge;
    }
    else if (chargeType === 'atom') {
        maxCharge = maxAbsoluteAtomCharges.get(typeId) || 0;
    }
    else {
        maxCharge = maxAbsoluteResidueCharges.get(typeId) || 0;
    }
    // forces coloring updates
    var contextHash = (_b = property_1.SbNcbrPartialChargesPropertyProvider.get(model)) === null || _b === void 0 ? void 0 : _b.version;
    var chargeMap = chargeType === 'atom' ? atomToCharge : residueToCharge;
    var color;
    if (!chargeMap) {
        color = function (_) { return Colors.MissingCharge; };
    }
    else {
        color = function (location) {
            var _a;
            var id = -1;
            if (structure_1.StructureElement.Location.is(location)) {
                if (structure_1.Unit.isAtomic(location.unit)) {
                    id = structure_1.StructureProperties.atom.id(location);
                }
            }
            else if (structure_1.Bond.isLocation(location)) {
                if (structure_1.Unit.isAtomic(location.aUnit)) {
                    var l = structure_1.StructureElement.Location.create((_a = ctx.structure) === null || _a === void 0 ? void 0 : _a.root);
                    l.unit = location.aUnit;
                    l.element = location.aUnit.elements[location.aIndex];
                    id = structure_1.StructureProperties.atom.id(l);
                }
            }
            var charge = chargeMap.get(id);
            if (charge === undefined) {
                console.warn('No charge found for id', id);
                return Colors.MissingCharge;
            }
            return Colors.getColor(charge, maxCharge);
        };
    }
    return {
        factory: PartialChargesColorTheme,
        granularity: 'group',
        color: color,
        props: props,
        description: 'Color atoms and residues based on their partial charge.',
        preferSmoothing: false,
        contextHash: contextHash,
    };
}
exports.PartialChargesColorTheme = PartialChargesColorTheme;
exports.SbNcbrPartialChargesColorThemeProvider = {
    label: 'SB NCBR Partial Charges',
    name: 'sb-ncbr-partial-charges',
    category: color_1.ColorTheme.Category.Atom,
    factory: PartialChargesColorTheme,
    getParams: getPartialChargesThemeParams,
    defaultValues: param_definition_1.ParamDefinition.getDefaultValues(exports.PartialChargesThemeParams),
    isApplicable: function (ctx) {
        return !!ctx.structure &&
            ctx.structure.models.some(function (model) { return property_1.SbNcbrPartialChargesPropertyProvider.isApplicable(model); });
    },
    ensureCustomProperties: {
        attach: function (ctx, data) {
            return data.structure
                ? property_1.SbNcbrPartialChargesPropertyProvider.attach(ctx, data.structure.models[0], void 0, true)
                : Promise.resolve();
        },
        detach: function (data) { return data.structure && property_1.SbNcbrPartialChargesPropertyProvider.ref(data.structure.models[0], false); },
    },
};
