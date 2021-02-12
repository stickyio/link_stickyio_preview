'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioBillingModelID: 123
    }
};

describe('product line item stickyioBillingModelID decorator', function () {
    var stickyioBillingModelID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioBillingModelID');

    it('should create stickyioBillingModelID property for passed in object', function () {
        var object = {};
        stickyioBillingModelID(object, lineItemMock);

        assert.equal(object.stickyioBillingModelID, 123);
    });
});