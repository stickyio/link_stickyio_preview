'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioSubscriptionID: 'someSubscriptionID'
    }
};

describe('product line item stickyioSubscriptionID decorator', function () {
    var stickyioSubscriptionID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioSubscriptionID');

    it('should create stickyioSubscriptionID property for passed in object', function () {
        var object = {};
        stickyioSubscriptionID(object, lineItemMock);

        assert.equal(object.stickyioSubscriptionID, 'someSubscriptionID');
    });
});
