import { Bond, StructureElement, StructureProperties, Unit } from '../../../mol-model/structure';
import { ColorTheme } from '../../../mol-theme/color';
import { Color } from '../../../mol-util/color';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { SbNcbrPartialChargesPropertyProvider } from './property';
var Colors = {
    Bond: Color(0xffffff),
    Error: Color(0x00ff00),
    MissingCharge: Color(0xffffff),
    Negative: Color(0xff0000),
    Zero: Color(0xffffff),
    Positive: Color(0x0000ff),
    getColor: function (charge, maxCharge) {
        if (charge === 0)
            return Colors.Zero;
        if (charge <= -maxCharge)
            return Colors.Negative;
        if (charge >= maxCharge)
            return Colors.Positive;
        var t = maxCharge !== 0 ? Math.abs(charge) / maxCharge : 1;
        var endColor = charge < 0 ? Colors.Negative : Colors.Positive;
        return Color.interpolate(Colors.Zero, endColor, t);
    },
};
export var PartialChargesThemeParams = {
    maxAbsoluteCharge: PD.Numeric(0, { min: 0 }, {
        label: 'Charge Range',
    }),
    absolute: PD.Boolean(false, { isHidden: false, label: 'Use Range' }),
    chargeType: PD.Select('residue', [
        ['atom', 'Atom charges'],
        ['residue', 'Residue charges'],
    ], { isHidden: false }),
};
export function getPartialChargesThemeParams() {
    return PD.clone(PartialChargesThemeParams);
}
export function PartialChargesColorTheme(ctx, props) {
    var _a, _b;
    var model = (_a = ctx.structure) === null || _a === void 0 ? void 0 : _a.models[0];
    if (!model) {
        throw new Error('No model found');
    }
    var data = SbNcbrPartialChargesPropertyProvider.get(model).value;
    if (!data) {
        throw new Error('No partial charges data found');
    }
    var absolute = props.absolute, chargeType = props.chargeType;
    var typeIdToAtomIdToCharge = data.typeIdToAtomIdToCharge, typeIdToResidueToCharge = data.typeIdToResidueToCharge, maxAbsoluteAtomCharges = data.maxAbsoluteAtomCharges, maxAbsoluteResidueCharges = data.maxAbsoluteResidueCharges;
    var typeId = SbNcbrPartialChargesPropertyProvider.props(model).typeId;
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
    var contextHash = (_b = SbNcbrPartialChargesPropertyProvider.get(model)) === null || _b === void 0 ? void 0 : _b.version;
    var chargeMap = chargeType === 'atom' ? atomToCharge : residueToCharge;
    var color;
    if (!chargeMap) {
        color = function (_) { return Colors.MissingCharge; };
    }
    else {
        color = function (location) {
            var _a;
            var id = -1;
            if (StructureElement.Location.is(location)) {
                if (Unit.isAtomic(location.unit)) {
                    id = StructureProperties.atom.id(location);
                }
            }
            else if (Bond.isLocation(location)) {
                if (Unit.isAtomic(location.aUnit)) {
                    var l = StructureElement.Location.create((_a = ctx.structure) === null || _a === void 0 ? void 0 : _a.root);
                    l.unit = location.aUnit;
                    l.element = location.aUnit.elements[location.aIndex];
                    id = StructureProperties.atom.id(l);
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
export var SbNcbrPartialChargesColorThemeProvider = {
    label: 'SB NCBR Partial Charges',
    name: 'sb-ncbr-partial-charges',
    category: ColorTheme.Category.Atom,
    factory: PartialChargesColorTheme,
    getParams: getPartialChargesThemeParams,
    defaultValues: PD.getDefaultValues(PartialChargesThemeParams),
    isApplicable: function (ctx) {
        return !!ctx.structure &&
            ctx.structure.models.some(function (model) { return SbNcbrPartialChargesPropertyProvider.isApplicable(model); });
    },
    ensureCustomProperties: {
        attach: function (ctx, data) {
            return data.structure
                ? SbNcbrPartialChargesPropertyProvider.attach(ctx, data.structure.models[0], void 0, true)
                : Promise.resolve();
        },
        detach: function (data) { return data.structure && SbNcbrPartialChargesPropertyProvider.ref(data.structure.models[0], false); },
    },
};
