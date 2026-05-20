/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { __spreadArray } from "tslib";
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
import { ResidueNameColorTheme, ResidueNameColorThemeParams } from './residue-name';
import { SecondaryStructureColorTheme, SecondaryStructureColorThemeParams } from './secondary-structure';
import { ElementSymbolColorTheme, ElementSymbolColorThemeParams } from './element-symbol';
var Description = 'Uses separate themes for coloring mainchain and sidechain visuals.';
export var CartoonColorThemeParams = {
    mainchain: PD.MappedStatic('molecule-type', {
        uniform: PD.Group(UniformColorThemeParams),
        'chain-id': PD.Group(ChainIdColorThemeParams),
        'entity-id': PD.Group(EntityIdColorThemeParams),
        'entity-source': PD.Group(EntitySourceColorThemeParams),
        'molecule-type': PD.Group(MoleculeTypeColorThemeParams),
        'model-index': PD.Group(ModelIndexColorThemeParams),
        'structure-index': PD.Group(StructureIndexColorThemeParams),
        'secondary-structure': PD.Group(SecondaryStructureColorThemeParams),
    }),
    sidechain: PD.MappedStatic('residue-name', {
        uniform: PD.Group(UniformColorThemeParams),
        'residue-name': PD.Group(ResidueNameColorThemeParams),
        'element-symbol': PD.Group(ElementSymbolColorThemeParams),
    }),
};
export function getCartoonColorThemeParams(ctx) {
    var params = PD.clone(CartoonColorThemeParams);
    return params;
}
function getMainchainTheme(ctx, props) {
    switch (props.name) {
        case 'uniform': return UniformColorTheme(ctx, props.params);
        case 'chain-id': return ChainIdColorTheme(ctx, props.params);
        case 'entity-id': return EntityIdColorTheme(ctx, props.params);
        case 'entity-source': return EntitySourceColorTheme(ctx, props.params);
        case 'molecule-type': return MoleculeTypeColorTheme(ctx, props.params);
        case 'model-index': return ModelIndexColorTheme(ctx, props.params);
        case 'structure-index': return StructureIndexColorTheme(ctx, props.params);
        case 'secondary-structure': return SecondaryStructureColorTheme(ctx, props.params);
        default: assertUnreachable(props);
    }
}
function getSidechainTheme(ctx, props) {
    switch (props.name) {
        case 'uniform': return UniformColorTheme(ctx, props.params);
        case 'residue-name': return ResidueNameColorTheme(ctx, props.params);
        case 'element-symbol': return ElementSymbolColorTheme(ctx, props.params);
        default: assertUnreachable(props);
    }
}
export function CartoonColorTheme(ctx, props) {
    var _a, _b;
    var mainchain = getMainchainTheme(ctx, props.mainchain);
    var sidechain = getSidechainTheme(ctx, props.sidechain);
    function color(location, isSecondary) {
        return isSecondary ? mainchain.color(location, false) : sidechain.color(location, false);
    }
    var legend = mainchain.legend;
    if (((_a = mainchain.legend) === null || _a === void 0 ? void 0 : _a.kind) === 'table-legend' && ((_b = sidechain.legend) === null || _b === void 0 ? void 0 : _b.kind) === 'table-legend') {
        legend = {
            kind: 'table-legend',
            table: __spreadArray(__spreadArray([], mainchain.legend.table, true), sidechain.legend.table, true)
        };
    }
    return {
        factory: CartoonColorTheme,
        granularity: 'group',
        preferSmoothing: false,
        color: color,
        props: props,
        description: Description,
        legend: legend,
    };
}
export var CartoonColorThemeProvider = {
    name: 'cartoon',
    label: 'Cartoon',
    category: ColorThemeCategory.Misc,
    factory: CartoonColorTheme,
    getParams: getCartoonColorThemeParams,
    defaultValues: PD.getDefaultValues(CartoonColorThemeParams),
    isApplicable: function (ctx) { return !!ctx.structure; }
};
