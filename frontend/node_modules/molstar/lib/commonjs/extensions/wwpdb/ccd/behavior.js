"use strict";
/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wwPDBChemicalComponentDictionary = void 0;
var tslib_1 = require("tslib");
var behavior_1 = require("../../../mol-plugin/behavior/behavior");
var representation_1 = require("./representation");
exports.wwPDBChemicalComponentDictionary = behavior_1.PluginBehavior.create({
    name: 'wwpdb-chemical-component-dictionary',
    category: 'representation',
    display: {
        name: 'wwPDB Chemical Compontent Dictionary',
        description: 'Custom representation for data loaded from the CCD.'
    },
    ctor: /** @class */ (function (_super) {
        tslib_1.__extends(class_1, _super);
        function class_1() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        class_1.prototype.register = function () {
            this.ctx.builders.structure.hierarchy.registerPreset(representation_1.ChemicalCompontentTrajectoryHierarchyPreset);
            this.ctx.builders.structure.representation.registerPreset(representation_1.ChemicalComponentPreset);
        };
        class_1.prototype.update = function () {
            return false;
        };
        class_1.prototype.unregister = function () {
            this.ctx.builders.structure.hierarchy.unregisterPreset(representation_1.ChemicalCompontentTrajectoryHierarchyPreset);
            this.ctx.builders.structure.representation.unregisterPreset(representation_1.ChemicalComponentPreset);
        };
        return class_1;
    }(behavior_1.PluginBehavior.Handler)),
    params: function () { return ({}); }
});
