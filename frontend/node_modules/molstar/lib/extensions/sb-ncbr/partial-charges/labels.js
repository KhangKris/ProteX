import { StructureElement, StructureProperties } from '../../../mol-model/structure';
import { SbNcbrPartialChargesPropertyProvider, hasPartialChargesCategories } from './property';
export function SbNcbrPartialChargesLociLabelProvider(ctx) {
    return {
        label: function (loci) {
            var _a, _b;
            if (!StructureElement.Loci.is(loci))
                return;
            var model = loci.structure.model;
            if (!hasPartialChargesCategories(model))
                return;
            var data = SbNcbrPartialChargesPropertyProvider.get(model).value;
            if (!data)
                return;
            var loc = StructureElement.Loci.getFirstLocation(loci);
            if (!loc)
                return;
            var granularity = ctx.managers.interactivity.props.granularity;
            if (granularity !== 'element' && granularity !== 'residue') {
                return;
            }
            var atomId = StructureProperties.atom.id(loc);
            var typeIdToAtomIdToCharge = data.typeIdToAtomIdToCharge, typeIdToResidueToCharge = data.typeIdToResidueToCharge;
            var typeId = SbNcbrPartialChargesPropertyProvider.props(model).typeId;
            var showResidueCharge = granularity === 'residue';
            var charge = showResidueCharge
                ? (_a = typeIdToResidueToCharge.get(typeId)) === null || _a === void 0 ? void 0 : _a.get(atomId)
                : (_b = typeIdToAtomIdToCharge.get(typeId)) === null || _b === void 0 ? void 0 : _b.get(atomId);
            var label = granularity === 'residue' ? 'Residue charge' : 'Atom charge';
            return "<strong>".concat(label, ": ").concat((charge === null || charge === void 0 ? void 0 : charge.toFixed(4)) || 'undefined', "</strong>");
        },
        group: function (label) { return label.toString().replace(/Model [0-9]+/g, 'Models'); },
    };
}
