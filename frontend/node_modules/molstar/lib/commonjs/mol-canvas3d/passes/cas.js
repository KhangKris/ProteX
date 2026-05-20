"use strict";
/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasPass = exports.CasParams = void 0;
var tslib_1 = require("tslib");
var util_1 = require("../../mol-gl/compute/util");
var renderable_1 = require("../../mol-gl/renderable");
var schema_1 = require("../../mol-gl/renderable/schema");
var shader_code_1 = require("../../mol-gl/shader-code");
var render_item_1 = require("../../mol-gl/webgl/render-item");
var linear_algebra_1 = require("../../mol-math/linear-algebra");
var mol_util_1 = require("../../mol-util");
var param_definition_1 = require("../../mol-util/param-definition");
var quad_vert_1 = require("../../mol-gl/shader/quad.vert");
var debug_1 = require("../../mol-util/debug");
var cas_frag_1 = require("../../mol-gl/shader/cas.frag");
exports.CasParams = {
    sharpness: param_definition_1.ParamDefinition.Numeric(0.5, { min: 0, max: 1, step: 0.05 }),
    denoise: param_definition_1.ParamDefinition.Boolean(true),
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
        mol_util_1.ValueCell.update(this.renderable.values.uTexSizeInv, linear_algebra_1.Vec2.set(this.renderable.values.uTexSizeInv.ref.value, 1 / width, 1 / height));
    };
    CasPass.prototype.update = function (input, props) {
        var values = this.renderable.values;
        var sharpness = props.sharpness, denoise = props.denoise;
        var needsUpdate = false;
        if (values.tColor.ref.value !== input) {
            mol_util_1.ValueCell.update(this.renderable.values.tColor, input);
            needsUpdate = true;
        }
        mol_util_1.ValueCell.updateIfChanged(values.uSharpness, 2 - 2 * Math.pow(sharpness, 0.25));
        if (values.dDenoise.ref.value !== denoise)
            needsUpdate = true;
        mol_util_1.ValueCell.updateIfChanged(values.dDenoise, denoise);
        if (needsUpdate) {
            this.renderable.update();
        }
    };
    CasPass.prototype.render = function (viewport, target) {
        if (debug_1.isTimingMode)
            this.webgl.timer.mark('CasPass.render');
        if (target) {
            target.bind();
        }
        else {
            this.webgl.unbindFramebuffer();
        }
        this.updateState(viewport);
        this.renderable.render();
        if (debug_1.isTimingMode)
            this.webgl.timer.markEnd('CasPass.render');
    };
    return CasPass;
}());
exports.CasPass = CasPass;
//
var CasSchema = tslib_1.__assign(tslib_1.__assign({}, util_1.QuadSchema), { tColor: (0, schema_1.TextureSpec)('texture', 'rgba', 'ubyte', 'linear'), uTexSizeInv: (0, schema_1.UniformSpec)('v2'), uSharpness: (0, schema_1.UniformSpec)('f'), dDenoise: (0, schema_1.DefineSpec)('boolean') });
var CasShaderCode = (0, shader_code_1.ShaderCode)('cas', quad_vert_1.quad_vert, cas_frag_1.cas_frag);
function getCasRenderable(ctx, colorTexture) {
    var width = colorTexture.getWidth();
    var height = colorTexture.getHeight();
    var values = tslib_1.__assign(tslib_1.__assign({}, util_1.QuadValues), { tColor: mol_util_1.ValueCell.create(colorTexture), uTexSizeInv: mol_util_1.ValueCell.create(linear_algebra_1.Vec2.create(1 / width, 1 / height)), uSharpness: mol_util_1.ValueCell.create(0.5), dDenoise: mol_util_1.ValueCell.create(true) });
    var schema = tslib_1.__assign({}, CasSchema);
    var renderItem = (0, render_item_1.createComputeRenderItem)(ctx, 'triangles', CasShaderCode, schema, values);
    return (0, renderable_1.createComputeRenderable)(renderItem, values);
}
