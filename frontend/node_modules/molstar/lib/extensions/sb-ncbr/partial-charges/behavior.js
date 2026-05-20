import { __extends } from "tslib";
import { PluginBehavior } from '../../../mol-plugin/behavior';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { SbNcbrPartialChargesColorThemeProvider } from './color';
import { SbNcbrPartialChargesPropertyProvider } from './property';
import { SbNcbrPartialChargesLociLabelProvider } from './labels';
import { SbNcbrPartialChargesPreset } from './preset';
export var SbNcbrPartialCharges = PluginBehavior.create({
    name: 'sb-ncbr-partial-charges',
    category: 'misc',
    display: {
        name: 'SB NCBR Partial Charges',
    },
    ctor: /** @class */ (function (_super) {
        __extends(class_1, _super);
        function class_1() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.SbNcbrPartialChargesLociLabelProvider = SbNcbrPartialChargesLociLabelProvider(_this.ctx);
            return _this;
        }
        class_1.prototype.register = function () {
            this.ctx.customModelProperties.register(SbNcbrPartialChargesPropertyProvider, this.params.autoAttach);
            this.ctx.representation.structure.themes.colorThemeRegistry.add(SbNcbrPartialChargesColorThemeProvider);
            this.ctx.managers.lociLabels.addProvider(this.SbNcbrPartialChargesLociLabelProvider);
            this.ctx.builders.structure.representation.registerPreset(SbNcbrPartialChargesPreset);
        };
        class_1.prototype.unregister = function () {
            this.ctx.customModelProperties.unregister(SbNcbrPartialChargesPropertyProvider.descriptor.name);
            this.ctx.representation.structure.themes.colorThemeRegistry.remove(SbNcbrPartialChargesColorThemeProvider);
            this.ctx.managers.lociLabels.removeProvider(this.SbNcbrPartialChargesLociLabelProvider);
            this.ctx.builders.structure.representation.unregisterPreset(SbNcbrPartialChargesPreset);
        };
        return class_1;
    }(PluginBehavior.Handler)),
    params: function () { return ({
        autoAttach: PD.Boolean(true),
        showToolTip: PD.Boolean(true),
    }); },
});
