"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbNcbrPartialCharges = void 0;
var tslib_1 = require("tslib");
var behavior_1 = require("../../../mol-plugin/behavior");
var param_definition_1 = require("../../../mol-util/param-definition");
var color_1 = require("./color");
var property_1 = require("./property");
var labels_1 = require("./labels");
var preset_1 = require("./preset");
exports.SbNcbrPartialCharges = behavior_1.PluginBehavior.create({
    name: 'sb-ncbr-partial-charges',
    category: 'misc',
    display: {
        name: 'SB NCBR Partial Charges',
    },
    ctor: /** @class */ (function (_super) {
        tslib_1.__extends(class_1, _super);
        function class_1() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.SbNcbrPartialChargesLociLabelProvider = (0, labels_1.SbNcbrPartialChargesLociLabelProvider)(_this.ctx);
            return _this;
        }
        class_1.prototype.register = function () {
            this.ctx.customModelProperties.register(property_1.SbNcbrPartialChargesPropertyProvider, this.params.autoAttach);
            this.ctx.representation.structure.themes.colorThemeRegistry.add(color_1.SbNcbrPartialChargesColorThemeProvider);
            this.ctx.managers.lociLabels.addProvider(this.SbNcbrPartialChargesLociLabelProvider);
            this.ctx.builders.structure.representation.registerPreset(preset_1.SbNcbrPartialChargesPreset);
        };
        class_1.prototype.unregister = function () {
            this.ctx.customModelProperties.unregister(property_1.SbNcbrPartialChargesPropertyProvider.descriptor.name);
            this.ctx.representation.structure.themes.colorThemeRegistry.remove(color_1.SbNcbrPartialChargesColorThemeProvider);
            this.ctx.managers.lociLabels.removeProvider(this.SbNcbrPartialChargesLociLabelProvider);
            this.ctx.builders.structure.representation.unregisterPreset(preset_1.SbNcbrPartialChargesPreset);
        };
        return class_1;
    }(behavior_1.PluginBehavior.Handler)),
    params: function () { return ({
        autoAttach: param_definition_1.ParamDefinition.Boolean(true),
        showToolTip: param_definition_1.ParamDefinition.Boolean(true),
    }); },
});
