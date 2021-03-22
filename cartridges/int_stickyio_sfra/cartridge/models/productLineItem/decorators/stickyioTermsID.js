'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioTermsID', {
        enumerable: true,
        value: lineItem.custom.stickyioTermsID
    });
};
