'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioProductID: 123
    }
};

describe('product line item stickyioProductID decorator', function () {
    var stickyioProductID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioProductID');

    it('should create stickyioProductID property for passed in object', function () {
        var object = {};
        stickyioProductID(object, lineItemMock);

        assert.equal(object.stickyioProductID, 123);
    });
});