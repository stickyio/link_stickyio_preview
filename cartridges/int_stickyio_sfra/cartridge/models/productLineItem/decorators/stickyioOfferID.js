'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioOfferID', {
        enumerable: true,
        value: lineItem.custom.stickyioOfferID
    });
};
