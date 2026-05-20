/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { Color } from '../../mol-util/color';
import { StructureElement, Unit, Bond } from '../../mol-model/structure';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { ChainIdColorTheme, ChainIdColorThemeParams } from './chain-id';
import { UniformColorTheme, UniformColorThemeParams } from './uniform';
import { assertUnreachable } from '../../mol-util/type-helpers';
import { EntityIdColorTheme, EntityIdColorThemeParams } from './entity-id';
import { MoleculeTypeColorTheme, MoleculeTypeColorThemeParams } from './molecule-type';
import { EntitySourceColorTheme, EntitySourceColorThemeParams } from './entity-source';
import { ModelIndexColorTheme, ModelIndexColorThemeParams } from './model-index';
import { StructureIndexColorTheme, StructureIndexColorThemeParams } from './structure-index';
import { ColorThemeCategory } from './categories';
var DefaultIllustrativeColor = Color(0xEEEEEE);
var Description = "Assigns an illustrative color that gives every chain a color based on the chosen style but with lighter carbons (inspired by David Goodsell's Molecule of the Month style).";
export var IllustrativeColorThemeParams = {
    style: PD.MappedStatic('entity-id', {
        uniform: PD.Group(UniformColorThemeParams),
        'chain-id': PD.Group(ChainIdColorThemeParams),
        'entity-id': PD.Group(EntityIdColorThemeParams),
        'entity-source': PD.Group(EntitySourceColorThemeParams),
        'molecule-type': PD.Group(MoleculeTypeColorThemeParams),
        'model-index': PD.Group(ModelIndexColorThemeParams),
        'structure-index': PD.Group(StructureIndexColorThemeParams),
    }),
    carbonLightness: PD.Numeric(0.8, { min: -6, max: 6, step: 0.1 })
};
export function getIllustrativeColorThemeParams(ctx) {
    var params = PD.clone(IllustrativeColorThemeParams);
    return params;
}
function getStyleTheme(ctx, props) {
    switch (props.name) {
        case 'uniform': return UniformColorTheme(ctx, props.params);
        case 'chain-id': return ChainIdColorTheme(ctx, props.params);
        case 'entity-id': return EntityIdColorTheme(ctx, props.params);
        case 'entity-source': return EntitySourceColorTheme(ctx, props.params);
        case 'molecule-type': return MoleculeTypeColorTheme(ctx, props.params);
        case 'model-index': return ModelIndexColorTheme(ctx, props.params);
        case 'structure-index': return StructureIndexColorTheme(ctx, props.params);
        default: assertUnreachable(props);
    }
}
export function IllustrativeColorTheme(ctx, props) {
    var _a = getStyleTheme(ctx, props.style), styleColor = _a.color, legend = _a.legend;
    function illustrativeColor(location, typeSymbol) {
        var baseColor = styleColor(location, false);
        return typeSymbol === 'C' ? Color.lighten(baseColor, props.carbonLightness) : baseColor;
    }
    function color(location) {
        if (StructureElement.Location.is(location) && Unit.isAtomic(location.unit)) {
            var typeSymbol = location.unit.model.atomicHierarchy.atoms.type_symbol.value(location.element);
            return illustrativeColor(location, typeSymbol);
        }
        else if (Bond.isLocation(location) && Unit.isAtomic(location.aUnit)) {
            var elementIndex = location.aUnit.elements[location.aIndex];
            var typeSymbol = location.aUnit.model.atomicHierarchy.atoms.type_symbol.value(elementIndex);
            return illustrativeColor(location, typeSymbol);
        }
        return DefaultIllustrativeColor;
    }
    return {
        factory: IllustrativeColorTheme,
        granularity: 'group',
        preferSmoothing: true,
        color: color,
        props: props,
        description: Description,
        legend: legend
    };
}
export var IllustrativeColorThemeProvider = {
    name: 'illustrative',
    label: 'Illustrative',
    category: ColorThemeCategory.Misc,
    factory: IllustrativeColorTheme,
    getParams: getIllustrativeColorThemeParams,
    defaultValues: PD.getDefaultValues(IllustrativeColorThemeParams),
    isApplicable: function (ctx) { return !!ctx.structure; }
};
