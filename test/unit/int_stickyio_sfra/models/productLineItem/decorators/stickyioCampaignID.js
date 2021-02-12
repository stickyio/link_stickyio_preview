'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioCampaignID: 123
    }
};

describe('product line item stickyioCampaignID decorator', function () {
    var stickyioCampaignID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioCampaignID');

    it('should create stickyioCampaignID property for passed in object', function () {
        var object = {};
        stickyioCampaignID(object, lineItemMock);

        assert.equal(object.stickyioCampaignID, 123);
    });
});