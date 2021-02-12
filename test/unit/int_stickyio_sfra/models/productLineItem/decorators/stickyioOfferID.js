'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioOfferID: 123
    }
};

describe('product line item stickyioOfferID decorator', function () {
    var stickyioOfferID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioOfferID');

    it('should create stickyioOfferID property for passed in object', function () {
        var object = {};
        stickyioOfferID(object, lineItemMock);

        assert.equal(object.stickyioOfferID, 123);
    });
});