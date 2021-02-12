'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioBillingModelDetails: 'someBillingModelDetails'
    }
};

describe('product line item stickyioBillingModelDetails decorator', function () {
    var stickyioBillingModelDetails = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioBillingModelDetails');

    it('should create stickyioBillingModelDetails property for passed in object', function () {
        var object = {};
        stickyioBillingModelDetails(object, lineItemMock);

        assert.equal(object.stickyioBillingModelDetails, 'someBillingModelDetails');
    });
});