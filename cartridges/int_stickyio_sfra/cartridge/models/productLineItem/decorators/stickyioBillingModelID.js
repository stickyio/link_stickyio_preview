'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioBillingModelID', {
        enumerable: true,
        value: lineItem.custom.stickyioBillingModelID
    });
};
