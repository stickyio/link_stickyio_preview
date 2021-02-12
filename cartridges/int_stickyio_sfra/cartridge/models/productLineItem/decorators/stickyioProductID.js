'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioProductID', {
        enumerable: true,
        value: lineItem.custom.stickyioProductID
    });
};
