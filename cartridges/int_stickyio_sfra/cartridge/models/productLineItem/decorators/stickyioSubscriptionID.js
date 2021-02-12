'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioSubscriptionID', {
        enumerable: true,
        value: lineItem.custom.stickyioSubscriptionID
    });
};
