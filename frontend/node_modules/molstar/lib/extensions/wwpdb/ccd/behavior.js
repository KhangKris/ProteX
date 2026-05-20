/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */
import { __extends } from "tslib";
import { PluginBehavior } from '../../../mol-plugin/behavior/behavior';
import { ChemicalComponentPreset, ChemicalCompontentTrajectoryHierarchyPreset } from './representation';
export var wwPDBChemicalComponentDictionary = PluginBehavior.create({
    name: 'wwpdb-chemical-component-dictionary',
    category: 'representation',
    display: {
        name: 'wwPDB Chemical Compontent Dictionary',
        description: 'Custom representation for data loaded from the CCD.'
    },
    ctor: /** @class */ (function (_super) {
        __extends(class_1, _super);
        function class_1() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        class_1.prototype.register = function () {
            this.ctx.builders.structure.hierarchy.registerPreset(ChemicalCompontentTrajectoryHierarchyPreset);
            this.ctx.builders.structure.representation.registerPreset(ChemicalComponentPreset);
        };
        class_1.prototype.update = function () {
            return false;
        };
        class_1.prototype.unregister = function () {
            this.ctx.builders.structure.hierarchy.unregisterPreset(ChemicalCompontentTrajectoryHierarchyPreset);
            this.ctx.builders.structure.representation.unregisterPreset(ChemicalComponentPreset);
        };
        return class_1;
    }(PluginBehavior.Handler)),
    params: function () { return ({}); }
});
