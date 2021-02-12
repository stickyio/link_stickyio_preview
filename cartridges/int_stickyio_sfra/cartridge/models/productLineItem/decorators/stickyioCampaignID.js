'use strict';

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'stickyioCampaignID', {
        enumerable: true,
        value: lineItem.custom.stickyioCampaignID
    });
};
