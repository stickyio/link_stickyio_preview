'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioVariationID', {
        enumerable: true,
        value: lineItem.custom.stickyioVariationID
    });
};
