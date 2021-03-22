'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioCycles', {
        enumerable: true,
        value: lineItem.custom.stickyioCycles
    });
};
