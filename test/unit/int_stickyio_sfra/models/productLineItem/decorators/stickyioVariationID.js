'use strict';

var assert = require('chai').assert;

var lineItemMock = {
    custom: {
        stickyioVariationID: 123
    }
};

describe('product line item stickyioVariationID decorator', function () {
    var stickyioVariationID = require('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/decorators/stickyioVariationID');

    it('should create stickyioVariationID property for passed in object', function () {
        var object = {};
        stickyioVariationID(object, lineItemMock);

        assert.equal(object.stickyioVariationID, 123);
    });
});
