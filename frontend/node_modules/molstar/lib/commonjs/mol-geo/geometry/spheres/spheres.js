"use strict";
/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spheres = void 0;
var tslib_1 = require("tslib");
var mol_util_1 = require("../../../mol-util");
var param_definition_1 = require("../../../mol-util/param-definition");
var location_iterator_1 = require("../../../mol-geo/util/location-iterator");
var color_data_1 = require("../color-data");
var marker_data_1 = require("../marker-data");
var util_1 = require("../../../mol-gl/renderable/util");
var geometry_1 = require("../../../mol-math/geometry");
var size_data_1 = require("../size-data");
var base_1 = require("../base");
var overpaint_data_1 = require("../overpaint-data");
var transparency_data_1 = require("../transparency-data");
var util_2 = require("../../../mol-data/util");
var util_3 = require("../../util");
var clipping_data_1 = require("../clipping-data");
var linear_algebra_1 = require("../../../mol-math/linear-algebra");
var substance_data_1 = require("../substance-data");
var Spheres;
(function (Spheres) {
    function create(centers, groups, sphereCount, spheres) {
        return spheres ?
            update(centers, groups, sphereCount, spheres) :
            fromArrays(centers, groups, sphereCount);
    }
    Spheres.create = create;
    function createEmpty(spheres) {
        var cb = spheres ? spheres.centerBuffer.ref.value : new Float32Array(0);
        var gb = spheres ? spheres.groupBuffer.ref.value : new Float32Array(0);
        return create(cb, gb, 0, spheres);
    }
    Spheres.createEmpty = createEmpty;
    function hashCode(spheres) {
        return (0, util_2.hashFnv32a)([
            spheres.sphereCount,
            spheres.centerBuffer.ref.version,
            spheres.groupBuffer.ref.version
        ]);
    }
    function fromArrays(centers, groups, sphereCount) {
        var boundingSphere = (0, geometry_1.Sphere3D)();
        var groupMapping;
        var currentHash = -1;
        var currentGroup = -1;
        var positionGroup = mol_util_1.ValueCell.create((0, util_1.createTextureImage)(1, 4, Float32Array));
        var texDim = mol_util_1.ValueCell.create(linear_algebra_1.Vec2.create(0, 0));
        var spheres = {
            kind: 'spheres',
            sphereCount: sphereCount,
            centerBuffer: mol_util_1.ValueCell.create(centers),
            groupBuffer: mol_util_1.ValueCell.create(groups),
            get boundingSphere() {
                var newHash = hashCode(spheres);
                if (newHash !== currentHash) {
                    var b = (0, util_1.calculateInvariantBoundingSphere)(spheres.centerBuffer.ref.value, spheres.sphereCount * 4, 4);
                    geometry_1.Sphere3D.copy(boundingSphere, b);
                    currentHash = newHash;
                }
                return boundingSphere;
            },
            get groupMapping() {
                if (spheres.groupBuffer.ref.version !== currentGroup) {
                    groupMapping = (0, util_3.createGroupMapping)(spheres.groupBuffer.ref.value, spheres.sphereCount, 4);
                    currentGroup = spheres.groupBuffer.ref.version;
                }
                return groupMapping;
            },
            setBoundingSphere: function (sphere) {
                geometry_1.Sphere3D.copy(boundingSphere, sphere);
                currentHash = hashCode(spheres);
            },
            shaderData: {
                positionGroup: positionGroup,
                texDim: texDim,
                update: function () {
                    var pgt = (0, util_1.createTextureImage)(spheres.sphereCount, 4, Float32Array, positionGroup.ref.value.array);
                    setPositionGroup(pgt, spheres.centerBuffer.ref.value, spheres.groupBuffer.ref.value, spheres.sphereCount);
                    mol_util_1.ValueCell.update(positionGroup, pgt);
                    mol_util_1.ValueCell.update(texDim, linear_algebra_1.Vec2.set(texDim.ref.value, pgt.width, pgt.height));
                }
            },
        };
        return spheres;
    }
    function update(centers, groups, sphereCount, spheres) {
        spheres.sphereCount = sphereCount;
        mol_util_1.ValueCell.update(spheres.centerBuffer, centers);
        mol_util_1.ValueCell.update(spheres.groupBuffer, groups);
        spheres.shaderData.update();
        return spheres;
    }
    function setPositionGroup(out, centers, groups, count) {
        var array = out.array;
        for (var i = 0; i < count; ++i) {
            array[i * 4 + 0] = centers[i * 3 + 0];
            array[i * 4 + 1] = centers[i * 3 + 1];
            array[i * 4 + 2] = centers[i * 3 + 2];
            array[i * 4 + 3] = groups[i];
        }
    }
    Spheres.Params = tslib_1.__assign(tslib_1.__assign({}, base_1.BaseGeometry.Params), { sizeFactor: param_definition_1.ParamDefinition.Numeric(1, { min: 0, max: 10, step: 0.1 }), doubleSided: param_definition_1.ParamDefinition.Boolean(false, base_1.BaseGeometry.CustomQualityParamInfo), ignoreLight: param_definition_1.ParamDefinition.Boolean(false, base_1.BaseGeometry.ShadingCategory), xrayShaded: param_definition_1.ParamDefinition.Select(false, [[false, 'Off'], [true, 'On'], ['inverted', 'Inverted']], base_1.BaseGeometry.ShadingCategory), transparentBackfaces: param_definition_1.ParamDefinition.Select('off', param_definition_1.ParamDefinition.arrayToOptions(['off', 'on', 'opaque']), base_1.BaseGeometry.ShadingCategory), solidInterior: param_definition_1.ParamDefinition.Boolean(true, base_1.BaseGeometry.ShadingCategory), clipPrimitive: param_definition_1.ParamDefinition.Boolean(false, tslib_1.__assign(tslib_1.__assign({}, base_1.BaseGeometry.ShadingCategory), { description: 'Clip whole sphere instead of cutting it.' })), approximate: param_definition_1.ParamDefinition.Boolean(false, tslib_1.__assign(tslib_1.__assign({}, base_1.BaseGeometry.ShadingCategory), { description: 'Faster rendering, but has artifacts.' })), alphaThickness: param_definition_1.ParamDefinition.Numeric(0, { min: 0, max: 20, step: 1 }, tslib_1.__assign(tslib_1.__assign({}, base_1.BaseGeometry.ShadingCategory), { description: 'If not zero, adjusts alpha for radius.' })), bumpFrequency: param_definition_1.ParamDefinition.Numeric(0, { min: 0, max: 10, step: 0.1 }, base_1.BaseGeometry.ShadingCategory), bumpAmplitude: param_definition_1.ParamDefinition.Numeric(1, { min: 0, max: 5, step: 0.1 }, base_1.BaseGeometry.ShadingCategory) });
    Spheres.Utils = {
        Params: Spheres.Params,
        createEmpty: createEmpty,
        createValues: createValues,
        createValuesSimple: createValuesSimple,
        updateValues: updateValues,
        updateBoundingSphere: updateBoundingSphere,
        createRenderableState: createRenderableState,
        updateRenderableState: updateRenderableState,
        createPositionIterator: createPositionIterator
    };
    function createPositionIterator(spheres, transform) {
        var groupCount = spheres.sphereCount;
        var instanceCount = transform.instanceCount.ref.value;
        var location = (0, location_iterator_1.PositionLocation)();
        var p = location.position;
        var v = spheres.centerBuffer.ref.value;
        var m = transform.aTransform.ref.value;
        var getLocation = function (groupIndex, instanceIndex) {
            if (instanceIndex < 0) {
                linear_algebra_1.Vec3.fromArray(p, v, groupIndex * 3);
            }
            else {
                linear_algebra_1.Vec3.transformMat4Offset(p, v, m, 0, groupIndex * 3, instanceIndex * 16);
            }
            return location;
        };
        return (0, location_iterator_1.LocationIterator)(groupCount, instanceCount, 1, getLocation);
    }
    function createValues(spheres, transform, locationIt, theme, props) {
        var instanceCount = locationIt.instanceCount, groupCount = locationIt.groupCount;
        var positionIt = createPositionIterator(spheres, transform);
        var color = (0, color_data_1.createColors)(locationIt, positionIt, theme.color);
        var size = (0, size_data_1.createSizes)(locationIt, theme.size);
        var marker = props.instanceGranularity
            ? (0, marker_data_1.createMarkers)(instanceCount, 'instance')
            : (0, marker_data_1.createMarkers)(instanceCount * groupCount, 'groupInstance');
        var overpaint = (0, overpaint_data_1.createEmptyOverpaint)();
        var transparency = (0, transparency_data_1.createEmptyTransparency)();
        var material = (0, substance_data_1.createEmptySubstance)();
        var clipping = (0, clipping_data_1.createEmptyClipping)();
        var counts = { drawCount: spheres.sphereCount * 2 * 3, vertexCount: spheres.sphereCount * 6, groupCount: groupCount, instanceCount: instanceCount };
        var padding = spheres.boundingSphere.radius ? (0, size_data_1.getMaxSize)(size) * props.sizeFactor : 0;
        var invariantBoundingSphere = geometry_1.Sphere3D.expand((0, geometry_1.Sphere3D)(), spheres.boundingSphere, padding);
        var boundingSphere = (0, util_1.calculateTransformBoundingSphere)(invariantBoundingSphere, transform.aTransform.ref.value, instanceCount, 0);
        spheres.shaderData.update();
        return tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({ dGeometryType: mol_util_1.ValueCell.create('spheres'), uTexDim: spheres.shaderData.texDim, tPositionGroup: spheres.shaderData.positionGroup, boundingSphere: mol_util_1.ValueCell.create(boundingSphere), invariantBoundingSphere: mol_util_1.ValueCell.create(invariantBoundingSphere), uInvariantBoundingSphere: mol_util_1.ValueCell.create(linear_algebra_1.Vec4.ofSphere(invariantBoundingSphere)) }, color), size), marker), overpaint), transparency), material), clipping), transform), { padding: mol_util_1.ValueCell.create(padding) }), base_1.BaseGeometry.createValues(props, counts)), { uSizeFactor: mol_util_1.ValueCell.create(props.sizeFactor), uDoubleSided: mol_util_1.ValueCell.create(props.doubleSided), dIgnoreLight: mol_util_1.ValueCell.create(props.ignoreLight), dXrayShaded: mol_util_1.ValueCell.create(props.xrayShaded === 'inverted' ? 'inverted' : props.xrayShaded === true ? 'on' : 'off'), dTransparentBackfaces: mol_util_1.ValueCell.create(props.transparentBackfaces), dSolidInterior: mol_util_1.ValueCell.create(props.solidInterior), dClipPrimitive: mol_util_1.ValueCell.create(props.clipPrimitive), dApproximate: mol_util_1.ValueCell.create(props.approximate), uAlphaThickness: mol_util_1.ValueCell.create(props.alphaThickness), uBumpFrequency: mol_util_1.ValueCell.create(props.bumpFrequency), uBumpAmplitude: mol_util_1.ValueCell.create(props.bumpAmplitude), centerBuffer: spheres.centerBuffer, groupBuffer: spheres.groupBuffer });
    }
    function createValuesSimple(spheres, props, colorValue, sizeValue, transform) {
        var s = base_1.BaseGeometry.createSimple(colorValue, sizeValue, transform);
        var p = tslib_1.__assign(tslib_1.__assign({}, param_definition_1.ParamDefinition.getDefaultValues(Spheres.Params)), props);
        return createValues(spheres, s.transform, s.locationIterator, s.theme, p);
    }
    function updateValues(values, props) {
        base_1.BaseGeometry.updateValues(values, props);
        mol_util_1.ValueCell.updateIfChanged(values.uSizeFactor, props.sizeFactor);
        mol_util_1.ValueCell.updateIfChanged(values.uDoubleSided, props.doubleSided);
        mol_util_1.ValueCell.updateIfChanged(values.dIgnoreLight, props.ignoreLight);
        mol_util_1.ValueCell.updateIfChanged(values.dXrayShaded, props.xrayShaded === 'inverted' ? 'inverted' : props.xrayShaded === true ? 'on' : 'off');
        mol_util_1.ValueCell.updateIfChanged(values.dTransparentBackfaces, props.transparentBackfaces);
        mol_util_1.ValueCell.updateIfChanged(values.dSolidInterior, props.solidInterior);
        mol_util_1.ValueCell.updateIfChanged(values.dClipPrimitive, props.clipPrimitive);
        mol_util_1.ValueCell.updateIfChanged(values.dApproximate, props.approximate);
        mol_util_1.ValueCell.updateIfChanged(values.uAlphaThickness, props.alphaThickness);
        mol_util_1.ValueCell.updateIfChanged(values.uBumpFrequency, props.bumpFrequency);
        mol_util_1.ValueCell.updateIfChanged(values.uBumpAmplitude, props.bumpAmplitude);
    }
    function updateBoundingSphere(values, spheres) {
        var padding = spheres.boundingSphere.radius
            ? (0, size_data_1.getMaxSize)(values) * values.uSizeFactor.ref.value
            : 0;
        var invariantBoundingSphere = geometry_1.Sphere3D.expand((0, geometry_1.Sphere3D)(), spheres.boundingSphere, padding);
        var boundingSphere = (0, util_1.calculateTransformBoundingSphere)(invariantBoundingSphere, values.aTransform.ref.value, values.instanceCount.ref.value, 0);
        if (!geometry_1.Sphere3D.equals(boundingSphere, values.boundingSphere.ref.value)) {
            mol_util_1.ValueCell.update(values.boundingSphere, boundingSphere);
        }
        if (!geometry_1.Sphere3D.equals(invariantBoundingSphere, values.invariantBoundingSphere.ref.value)) {
            mol_util_1.ValueCell.update(values.invariantBoundingSphere, invariantBoundingSphere);
            mol_util_1.ValueCell.update(values.uInvariantBoundingSphere, linear_algebra_1.Vec4.fromSphere(values.uInvariantBoundingSphere.ref.value, invariantBoundingSphere));
        }
        mol_util_1.ValueCell.update(values.padding, padding);
    }
    function createRenderableState(props) {
        var state = base_1.BaseGeometry.createRenderableState(props);
        updateRenderableState(state, props);
        return state;
    }
    function updateRenderableState(state, props) {
        base_1.BaseGeometry.updateRenderableState(state, props);
        state.opaque = state.opaque && !props.xrayShaded;
        state.writeDepth = state.opaque;
    }
})(Spheres || (exports.Spheres = Spheres = {}));
