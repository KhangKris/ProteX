/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
import { __assign } from "tslib";
import { ValueCell } from '../../../mol-util';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { LocationIterator, PositionLocation } from '../../../mol-geo/util/location-iterator';
import { createColors } from '../color-data';
import { createMarkers } from '../marker-data';
import { calculateInvariantBoundingSphere, calculateTransformBoundingSphere, createTextureImage } from '../../../mol-gl/renderable/util';
import { Sphere3D } from '../../../mol-math/geometry';
import { createSizes, getMaxSize } from '../size-data';
import { BaseGeometry } from '../base';
import { createEmptyOverpaint } from '../overpaint-data';
import { createEmptyTransparency } from '../transparency-data';
import { hashFnv32a } from '../../../mol-data/util';
import { createGroupMapping } from '../../util';
import { createEmptyClipping } from '../clipping-data';
import { Vec2, Vec3, Vec4 } from '../../../mol-math/linear-algebra';
import { createEmptySubstance } from '../substance-data';
export var Spheres;
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
        return hashFnv32a([
            spheres.sphereCount,
            spheres.centerBuffer.ref.version,
            spheres.groupBuffer.ref.version
        ]);
    }
    function fromArrays(centers, groups, sphereCount) {
        var boundingSphere = Sphere3D();
        var groupMapping;
        var currentHash = -1;
        var currentGroup = -1;
        var positionGroup = ValueCell.create(createTextureImage(1, 4, Float32Array));
        var texDim = ValueCell.create(Vec2.create(0, 0));
        var spheres = {
            kind: 'spheres',
            sphereCount: sphereCount,
            centerBuffer: ValueCell.create(centers),
            groupBuffer: ValueCell.create(groups),
            get boundingSphere() {
                var newHash = hashCode(spheres);
                if (newHash !== currentHash) {
                    var b = calculateInvariantBoundingSphere(spheres.centerBuffer.ref.value, spheres.sphereCount * 4, 4);
                    Sphere3D.copy(boundingSphere, b);
                    currentHash = newHash;
                }
                return boundingSphere;
            },
            get groupMapping() {
                if (spheres.groupBuffer.ref.version !== currentGroup) {
                    groupMapping = createGroupMapping(spheres.groupBuffer.ref.value, spheres.sphereCount, 4);
                    currentGroup = spheres.groupBuffer.ref.version;
                }
                return groupMapping;
            },
            setBoundingSphere: function (sphere) {
                Sphere3D.copy(boundingSphere, sphere);
                currentHash = hashCode(spheres);
            },
            shaderData: {
                positionGroup: positionGroup,
                texDim: texDim,
                update: function () {
                    var pgt = createTextureImage(spheres.sphereCount, 4, Float32Array, positionGroup.ref.value.array);
                    setPositionGroup(pgt, spheres.centerBuffer.ref.value, spheres.groupBuffer.ref.value, spheres.sphereCount);
                    ValueCell.update(positionGroup, pgt);
                    ValueCell.update(texDim, Vec2.set(texDim.ref.value, pgt.width, pgt.height));
                }
            },
        };
        return spheres;
    }
    function update(centers, groups, sphereCount, spheres) {
        spheres.sphereCount = sphereCount;
        ValueCell.update(spheres.centerBuffer, centers);
        ValueCell.update(spheres.groupBuffer, groups);
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
    Spheres.Params = __assign(__assign({}, BaseGeometry.Params), { sizeFactor: PD.Numeric(1, { min: 0, max: 10, step: 0.1 }), doubleSided: PD.Boolean(false, BaseGeometry.CustomQualityParamInfo), ignoreLight: PD.Boolean(false, BaseGeometry.ShadingCategory), xrayShaded: PD.Select(false, [[false, 'Off'], [true, 'On'], ['inverted', 'Inverted']], BaseGeometry.ShadingCategory), transparentBackfaces: PD.Select('off', PD.arrayToOptions(['off', 'on', 'opaque']), BaseGeometry.ShadingCategory), solidInterior: PD.Boolean(true, BaseGeometry.ShadingCategory), clipPrimitive: PD.Boolean(false, __assign(__assign({}, BaseGeometry.ShadingCategory), { description: 'Clip whole sphere instead of cutting it.' })), approximate: PD.Boolean(false, __assign(__assign({}, BaseGeometry.ShadingCategory), { description: 'Faster rendering, but has artifacts.' })), alphaThickness: PD.Numeric(0, { min: 0, max: 20, step: 1 }, __assign(__assign({}, BaseGeometry.ShadingCategory), { description: 'If not zero, adjusts alpha for radius.' })), bumpFrequency: PD.Numeric(0, { min: 0, max: 10, step: 0.1 }, BaseGeometry.ShadingCategory), bumpAmplitude: PD.Numeric(1, { min: 0, max: 5, step: 0.1 }, BaseGeometry.ShadingCategory) });
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
        var location = PositionLocation();
        var p = location.position;
        var v = spheres.centerBuffer.ref.value;
        var m = transform.aTransform.ref.value;
        var getLocation = function (groupIndex, instanceIndex) {
            if (instanceIndex < 0) {
                Vec3.fromArray(p, v, groupIndex * 3);
            }
            else {
                Vec3.transformMat4Offset(p, v, m, 0, groupIndex * 3, instanceIndex * 16);
            }
            return location;
        };
        return LocationIterator(groupCount, instanceCount, 1, getLocation);
    }
    function createValues(spheres, transform, locationIt, theme, props) {
        var instanceCount = locationIt.instanceCount, groupCount = locationIt.groupCount;
        var positionIt = createPositionIterator(spheres, transform);
        var color = createColors(locationIt, positionIt, theme.color);
        var size = createSizes(locationIt, theme.size);
        var marker = props.instanceGranularity
            ? createMarkers(instanceCount, 'instance')
            : createMarkers(instanceCount * groupCount, 'groupInstance');
        var overpaint = createEmptyOverpaint();
        var transparency = createEmptyTransparency();
        var material = createEmptySubstance();
        var clipping = createEmptyClipping();
        var counts = { drawCount: spheres.sphereCount * 2 * 3, vertexCount: spheres.sphereCount * 6, groupCount: groupCount, instanceCount: instanceCount };
        var padding = spheres.boundingSphere.radius ? getMaxSize(size) * props.sizeFactor : 0;
        var invariantBoundingSphere = Sphere3D.expand(Sphere3D(), spheres.boundingSphere, padding);
        var boundingSphere = calculateTransformBoundingSphere(invariantBoundingSphere, transform.aTransform.ref.value, instanceCount, 0);
        spheres.shaderData.update();
        return __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ dGeometryType: ValueCell.create('spheres'), uTexDim: spheres.shaderData.texDim, tPositionGroup: spheres.shaderData.positionGroup, boundingSphere: ValueCell.create(boundingSphere), invariantBoundingSphere: ValueCell.create(invariantBoundingSphere), uInvariantBoundingSphere: ValueCell.create(Vec4.ofSphere(invariantBoundingSphere)) }, color), size), marker), overpaint), transparency), material), clipping), transform), { padding: ValueCell.create(padding) }), BaseGeometry.createValues(props, counts)), { uSizeFactor: ValueCell.create(props.sizeFactor), uDoubleSided: ValueCell.create(props.doubleSided), dIgnoreLight: ValueCell.create(props.ignoreLight), dXrayShaded: ValueCell.create(props.xrayShaded === 'inverted' ? 'inverted' : props.xrayShaded === true ? 'on' : 'off'), dTransparentBackfaces: ValueCell.create(props.transparentBackfaces), dSolidInterior: ValueCell.create(props.solidInterior), dClipPrimitive: ValueCell.create(props.clipPrimitive), dApproximate: ValueCell.create(props.approximate), uAlphaThickness: ValueCell.create(props.alphaThickness), uBumpFrequency: ValueCell.create(props.bumpFrequency), uBumpAmplitude: ValueCell.create(props.bumpAmplitude), centerBuffer: spheres.centerBuffer, groupBuffer: spheres.groupBuffer });
    }
    function createValuesSimple(spheres, props, colorValue, sizeValue, transform) {
        var s = BaseGeometry.createSimple(colorValue, sizeValue, transform);
        var p = __assign(__assign({}, PD.getDefaultValues(Spheres.Params)), props);
        return createValues(spheres, s.transform, s.locationIterator, s.theme, p);
    }
    function updateValues(values, props) {
        BaseGeometry.updateValues(values, props);
        ValueCell.updateIfChanged(values.uSizeFactor, props.sizeFactor);
        ValueCell.updateIfChanged(values.uDoubleSided, props.doubleSided);
        ValueCell.updateIfChanged(values.dIgnoreLight, props.ignoreLight);
        ValueCell.updateIfChanged(values.dXrayShaded, props.xrayShaded === 'inverted' ? 'inverted' : props.xrayShaded === true ? 'on' : 'off');
        ValueCell.updateIfChanged(values.dTransparentBackfaces, props.transparentBackfaces);
        ValueCell.updateIfChanged(values.dSolidInterior, props.solidInterior);
        ValueCell.updateIfChanged(values.dClipPrimitive, props.clipPrimitive);
        ValueCell.updateIfChanged(values.dApproximate, props.approximate);
        ValueCell.updateIfChanged(values.uAlphaThickness, props.alphaThickness);
        ValueCell.updateIfChanged(values.uBumpFrequency, props.bumpFrequency);
        ValueCell.updateIfChanged(values.uBumpAmplitude, props.bumpAmplitude);
    }
    function updateBoundingSphere(values, spheres) {
        var padding = spheres.boundingSphere.radius
            ? getMaxSize(values) * values.uSizeFactor.ref.value
            : 0;
        var invariantBoundingSphere = Sphere3D.expand(Sphere3D(), spheres.boundingSphere, padding);
        var boundingSphere = calculateTransformBoundingSphere(invariantBoundingSphere, values.aTransform.ref.value, values.instanceCount.ref.value, 0);
        if (!Sphere3D.equals(boundingSphere, values.boundingSphere.ref.value)) {
            ValueCell.update(values.boundingSphere, boundingSphere);
        }
        if (!Sphere3D.equals(invariantBoundingSphere, values.invariantBoundingSphere.ref.value)) {
            ValueCell.update(values.invariantBoundingSphere, invariantBoundingSphere);
            ValueCell.update(values.uInvariantBoundingSphere, Vec4.fromSphere(values.uInvariantBoundingSphere.ref.value, invariantBoundingSphere));
        }
        ValueCell.update(values.padding, padding);
    }
    function createRenderableState(props) {
        var state = BaseGeometry.createRenderableState(props);
        updateRenderableState(state, props);
        return state;
    }
    function updateRenderableState(state, props) {
        BaseGeometry.updateRenderableState(state, props);
        state.opaque = state.opaque && !props.xrayShaded;
        state.writeDepth = state.opaque;
    }
})(Spheres || (Spheres = {}));
