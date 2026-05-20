/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { __assign } from "tslib";
import { createRenderable } from '../renderable';
import { createGraphicsRenderItem } from '../webgl/render-item';
import { GlobalUniformSchema, BaseSchema, InternalSchema, SizeSchema, ValueSpec, DefineSpec, GlobalTextureSchema, UniformSpec, TextureSpec } from './schema';
import { SpheresShaderCode } from '../shader-code';
import { ValueCell } from '../../mol-util';
export var SpheresSchema = __assign(__assign(__assign({}, BaseSchema), SizeSchema), { uTexDim: UniformSpec('v2'), tPositionGroup: TextureSpec('image-float32', 'rgba', 'float', 'nearest'), padding: ValueSpec('number'), uDoubleSided: UniformSpec('b', 'material'), dIgnoreLight: DefineSpec('boolean'), dXrayShaded: DefineSpec('string', ['off', 'on', 'inverted']), dTransparentBackfaces: DefineSpec('string', ['off', 'on', 'opaque']), dSolidInterior: DefineSpec('boolean'), dClipPrimitive: DefineSpec('boolean'), dApproximate: DefineSpec('boolean'), uAlphaThickness: UniformSpec('f'), uBumpFrequency: UniformSpec('f', 'material'), uBumpAmplitude: UniformSpec('f', 'material'), centerBuffer: ValueSpec('float32'), groupBuffer: ValueSpec('float32') });
export function SpheresRenderable(ctx, id, values, state, materialId, variants) {
    var schema = __assign(__assign(__assign(__assign({}, GlobalUniformSchema), GlobalTextureSchema), InternalSchema), SpheresSchema);
    var internalValues = {
        uObjectId: ValueCell.create(id),
    };
    var shaderCode = SpheresShaderCode;
    var renderItem = createGraphicsRenderItem(ctx, 'triangles', shaderCode, schema, __assign(__assign({}, values), internalValues), materialId, variants);
    return createRenderable(renderItem, values, state);
}
