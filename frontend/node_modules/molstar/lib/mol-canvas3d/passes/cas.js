/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { __assign } from "tslib";
import { QuadSchema, QuadValues } from '../../mol-gl/compute/util';
import { createComputeRenderable } from '../../mol-gl/renderable';
import { DefineSpec, TextureSpec, UniformSpec } from '../../mol-gl/renderable/schema';
import { ShaderCode } from '../../mol-gl/shader-code';
import { createComputeRenderItem } from '../../mol-gl/webgl/render-item';
import { Vec2 } from '../../mol-math/linear-algebra';
import { ValueCell } from '../../mol-util';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { quad_vert } from '../../mol-gl/shader/quad.vert';
import { isTimingMode } from '../../mol-util/debug';
import { cas_frag } from '../../mol-gl/shader/cas.frag';
export var CasParams = {
    sharpness: PD.Numeric(0.5, { min: 0, max: 1, step: 0.05 }),
    denoise: PD.Boolean(true),
};
var CasPass = /** @class */ (function () {
    function CasPass(webgl, input) {
        this.webgl = webgl;
        this.renderable = getCasRenderable(webgl, input);
    }
    CasPass.prototype.updateState = function (viewport) {
        var _a = this.webgl, gl = _a.gl, state = _a.state;
        state.enable(gl.SCISSOR_TEST);
        state.disable(gl.BLEND);
        state.disable(gl.DEPTH_TEST);
        state.depthMask(false);
        var x = viewport.x, y = viewport.y, width = viewport.width, height = viewport.height;
        state.viewport(x, y, width, height);
        state.scissor(x, y, width, height);
        state.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };
    CasPass.prototype.setSize = function (width, height) {
        ValueCell.update(this.renderable.values.uTexSizeInv, Vec2.set(this.renderable.values.uTexSizeInv.ref.value, 1 / width, 1 / height));
    };
    CasPass.prototype.update = function (input, props) {
        var values = this.renderable.values;
        var sharpness = props.sharpness, denoise = props.denoise;
        var needsUpdate = false;
        if (values.tColor.ref.value !== input) {
            ValueCell.update(this.renderable.values.tColor, input);
            needsUpdate = true;
        }
        ValueCell.updateIfChanged(values.uSharpness, 2 - 2 * Math.pow(sharpness, 0.25));
        if (values.dDenoise.ref.value !== denoise)
            needsUpdate = true;
        ValueCell.updateIfChanged(values.dDenoise, denoise);
        if (needsUpdate) {
            this.renderable.update();
        }
    };
    CasPass.prototype.render = function (viewport, target) {
        if (isTimingMode)
            this.webgl.timer.mark('CasPass.render');
        if (target) {
            target.bind();
        }
        else {
            this.webgl.unbindFramebuffer();
        }
        this.updateState(viewport);
        this.renderable.render();
        if (isTimingMode)
            this.webgl.timer.markEnd('CasPass.render');
    };
    return CasPass;
}());
export { CasPass };
//
var CasSchema = __assign(__assign({}, QuadSchema), { tColor: TextureSpec('texture', 'rgba', 'ubyte', 'linear'), uTexSizeInv: UniformSpec('v2'), uSharpness: UniformSpec('f'), dDenoise: DefineSpec('boolean') });
var CasShaderCode = ShaderCode('cas', quad_vert, cas_frag);
function getCasRenderable(ctx, colorTexture) {
    var width = colorTexture.getWidth();
    var height = colorTexture.getHeight();
    var values = __assign(__assign({}, QuadValues), { tColor: ValueCell.create(colorTexture), uTexSizeInv: ValueCell.create(Vec2.create(1 / width, 1 / height)), uSharpness: ValueCell.create(0.5), dDenoise: ValueCell.create(true) });
    var schema = __assign({}, CasSchema);
    var renderItem = createComputeRenderItem(ctx, 'triangles', CasShaderCode, schema, values);
    return createComputeRenderable(renderItem, values);
}
