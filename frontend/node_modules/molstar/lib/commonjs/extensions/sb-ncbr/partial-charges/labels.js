"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbNcbrPartialChargesLociLabelProvider = void 0;
var structure_1 = require("../../../mol-model/structure");
var property_1 = require("./property");
function SbNcbrPartialChargesLociLabelProvider(ctx) {
    return {
        label: function (loci) {
            var _a, _b;
            if (!structure_1.StructureElement.Loci.is(loci))
                return;
            var model = loci.structure.model;
            if (!(0, property_1.hasPartialChargesCategories)(model))
                return;
            var data = property_1.SbNcbrPartialChargesPropertyProvider.get(model).value;
            if (!data)
                return;
            var loc = structure_1.StructureElement.Loci.getFirstLocation(loci);
            if (!loc)
                return;
            var granularity = ctx.managers.interactivity.props.granularity;
            if (granularity !== 'element' && granularity !== 'residue') {
                return;
            }
            var atomId = structure_1.StructureProperties.atom.id(loc);
            var typeIdToAtomIdToCharge = data.typeIdToAtomIdToCharge, typeIdToResidueToCharge = data.typeIdToResidueToCharge;
            var typeId = property_1.SbNcbrPartialChargesPropertyProvider.props(model).typeId;
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
exports.SbNcbrPartialChargesLociLabelProvider = SbNcbrPartialChargesLociLabelProvider;
