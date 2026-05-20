"use strict";
/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpheresBuilder = void 0;
var util_1 = require("../../../mol-data/util");
var spheres_1 = require("./spheres");
// avoiding namespace lookup improved performance in Chrome (Aug 2020)
var caAdd3 = util_1.ChunkedArray.add3;
var caAdd = util_1.ChunkedArray.add;
var SpheresBuilder;
(function (SpheresBuilder) {
    function create(initialCount, chunkSize, spheres) {
        if (initialCount === void 0) { initialCount = 2048; }
        if (chunkSize === void 0) { chunkSize = 1024; }
        var centers = util_1.ChunkedArray.create(Float32Array, 3, chunkSize, spheres ? spheres.centerBuffer.ref.value : initialCount);
        var groups = util_1.ChunkedArray.create(Float32Array, 1, chunkSize, spheres ? spheres.groupBuffer.ref.value : initialCount);
        return {
            add: function (x, y, z, group) {
                caAdd3(centers, x, y, z);
                caAdd(groups, group);
            },
            getSpheres: function () {
                var cb = util_1.ChunkedArray.compact(centers, true);
                var gb = util_1.ChunkedArray.compact(groups, true);
                return spheres_1.Spheres.create(cb, gb, centers.elementCount, spheres);
            }
        };
    }
    SpheresBuilder.create = create;
})(SpheresBuilder || (exports.SpheresBuilder = SpheresBuilder = {}));
