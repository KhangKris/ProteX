"use strict";
/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartoonColorThemeProvider = exports.CartoonColorTheme = exports.getCartoonColorThemeParams = exports.CartoonColorThemeParams = void 0;
var tslib_1 = require("tslib");
var param_definition_1 = require("../../mol-util/param-definition");
var chain_id_1 = require("./chain-id");
var uniform_1 = require("./uniform");
var type_helpers_1 = require("../../mol-util/type-helpers");
var entity_id_1 = require("./entity-id");
var molecule_type_1 = require("./molecule-type");
var entity_source_1 = require("./entity-source");
var model_index_1 = require("./model-index");
var structure_index_1 = require("./structure-index");
var categories_1 = require("./categories");
var residue_name_1 = require("./residue-name");
var secondary_structure_1 = require("./secondary-structure");
var element_symbol_1 = require("./element-symbol");
var Description = 'Uses separate themes for coloring mainchain and sidechain visuals.';
exports.CartoonColorThemeParams = {
    mainchain: param_definition_1.ParamDefinition.MappedStatic('molecule-type', {
        uniform: param_definition_1.ParamDefinition.Group(uniform_1.UniformColorThemeParams),
        'chain-id': param_definition_1.ParamDefinition.Group(chain_id_1.ChainIdColorThemeParams),
        'entity-id': param_definition_1.ParamDefinition.Group(entity_id_1.EntityIdColorThemeParams),
        'entity-source': param_definition_1.ParamDefinition.Group(entity_source_1.EntitySourceColorThemeParams),
        'molecule-type': param_definition_1.ParamDefinition.Group(molecule_type_1.MoleculeTypeColorThemeParams),
        'model-index': param_definition_1.ParamDefinition.Group(model_index_1.ModelIndexColorThemeParams),
        'structure-index': param_definition_1.ParamDefinition.Group(structure_index_1.StructureIndexColorThemeParams),
        'secondary-structure': param_definition_1.ParamDefinition.Group(secondary_structure_1.SecondaryStructureColorThemeParams),
    }),
    sidechain: param_definition_1.ParamDefinition.MappedStatic('residue-name', {
        uniform: param_definition_1.ParamDefinition.Group(uniform_1.UniformColorThemeParams),
        'residue-name': param_definition_1.ParamDefinition.Group(residue_name_1.ResidueNameColorThemeParams),
        'element-symbol': param_definition_1.ParamDefinition.Group(element_symbol_1.ElementSymbolColorThemeParams),
    }),
};
function getCartoonColorThemeParams(ctx) {
    var params = param_definition_1.ParamDefinition.clone(exports.CartoonColorThemeParams);
    return params;
}
exports.getCartoonColorThemeParams = getCartoonColorThemeParams;
function getMainchainTheme(ctx, props) {
    switch (props.name) {
        case 'uniform': return (0, uniform_1.UniformColorTheme)(ctx, props.params);
        case 'chain-id': return (0, chain_id_1.ChainIdColorTheme)(ctx, props.params);
        case 'entity-id': return (0, entity_id_1.EntityIdColorTheme)(ctx, props.params);
        case 'entity-source': return (0, entity_source_1.EntitySourceColorTheme)(ctx, props.params);
        case 'molecule-type': return (0, molecule_type_1.MoleculeTypeColorTheme)(ctx, props.params);
        case 'model-index': return (0, model_index_1.ModelIndexColorTheme)(ctx, props.params);
        case 'structure-index': return (0, structure_index_1.StructureIndexColorTheme)(ctx, props.params);
        case 'secondary-structure': return (0, secondary_structure_1.SecondaryStructureColorTheme)(ctx, props.params);
        default: (0, type_helpers_1.assertUnreachable)(props);
    }
}
function getSidechainTheme(ctx, props) {
    switch (props.name) {
        case 'uniform': return (0, uniform_1.UniformColorTheme)(ctx, props.params);
        case 'residue-name': return (0, residue_name_1.ResidueNameColorTheme)(ctx, props.params);
        case 'element-symbol': return (0, element_symbol_1.ElementSymbolColorTheme)(ctx, props.params);
        default: (0, type_helpers_1.assertUnreachable)(props);
    }
}
function CartoonColorTheme(ctx, props) {
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
            table: tslib_1.__spreadArray(tslib_1.__spreadArray([], mainchain.legend.table, true), sidechain.legend.table, true)
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
exports.CartoonColorTheme = CartoonColorTheme;
exports.CartoonColorThemeProvider = {
    name: 'cartoon',
    label: 'Cartoon',
    category: categories_1.ColorThemeCategory.Misc,
    factory: CartoonColorTheme,
    getParams: getCartoonColorThemeParams,
    defaultValues: param_definition_1.ParamDefinition.getDefaultValues(exports.CartoonColorThemeParams),
    isApplicable: function (ctx) { return !!ctx.structure; }
};
