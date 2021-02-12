'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioBillingModelDetails', {
        enumerable: true,
        value: lineItem.custom.stickyioBillingModelDetails
    });
};
