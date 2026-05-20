/**
 * Copyright (c) 2018-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { Color } from '../../mol-util/color';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { TableLegend } from '../../mol-util/legend';
import { defaults } from '../../mol-util';
import { ColorThemeCategory } from './categories';
var DefaultColor = Color(0xCCCCCC);
var Description = 'Gives everything the same, uniform color.';
export var UniformColorThemeParams = {
    value: PD.Color(DefaultColor),
    saturation: PD.Numeric(0, { min: -6, max: 6, step: 0.1 }),
    lightness: PD.Numeric(0, { min: -6, max: 6, step: 0.1 }),
};
export function getUniformColorThemeParams(ctx) {
    return UniformColorThemeParams; // TODO return copy
}
export function UniformColorTheme(ctx, props) {
    var color = defaults(props.value, DefaultColor);
    color = Color.saturate(color, props.saturation);
    color = Color.lighten(color, props.lightness);
    return {
        factory: UniformColorTheme,
        granularity: 'uniform',
        color: function () { return color; },
        props: props,
        description: Description,
        legend: TableLegend([['uniform', color]])
    };
}
export var UniformColorThemeProvider = {
    name: 'uniform',
    label: 'Uniform',
    category: ColorThemeCategory.Misc,
    factory: UniformColorTheme,
    getParams: getUniformColorThemeParams,
    defaultValues: PD.getDefaultValues(UniformColorThemeParams),
    isApplicable: function (ctx) { return true; }
};
