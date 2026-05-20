"use strict";
/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixelData = void 0;
var PixelData;
(function (PixelData) {
    function create(array, width, height) {
        return { array: array, width: width, height: height };
    }
    PixelData.create = create;
    /** horizontally flips the pixel data in-place */
    function flipY(pixelData) {
        var array = pixelData.array, width = pixelData.width, height = pixelData.height;
        var itemSize = array.length / (width * height);
        var widthIS = width * itemSize;
        for (var i = 0, maxI = height / 2; i < maxI; ++i) {
            for (var j = 0, maxJ = widthIS; j < maxJ; ++j) {
                var index1 = i * widthIS + j;
                var index2 = (height - i - 1) * widthIS + j;
                var tmp = array[index1];
                array[index1] = array[index2];
                array[index2] = tmp;
            }
        }
        return pixelData;
    }
    PixelData.flipY = flipY;
    /** to undo pre-multiplied alpha */
    function divideByAlpha(pixelData) {
        var array = pixelData.array;
        var factor = (array instanceof Uint8Array) ? 255 : 1;
        for (var i = 0, il = array.length; i < il; i += 4) {
            var a = array[i + 3] / factor;
            array[i] /= a;
            array[i + 1] /= a;
            array[i + 2] /= a;
        }
        return pixelData;
    }
    PixelData.divideByAlpha = divideByAlpha;
})(PixelData || (exports.PixelData = PixelData = {}));
