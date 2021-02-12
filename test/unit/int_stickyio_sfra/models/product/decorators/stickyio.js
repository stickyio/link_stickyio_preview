'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var stickyioMocks = require('../../../../../mocks/stickyio');

var productMock = {
    custom: {
        stickyioSubscriptionActive: true,
        stickyioReady: true,
        stickyioBillingModelConsumerSelectable: true,
        stickyioProductID: 1,
        stickyioVariationID: 1,
        stickyioOfferID: {
            value: 1
        },
        stickyioCampaignID: 1
    },
    ID: '1',
    isVariant: function() { return false; }
};

var billingModelMock = {
    '2': { id: 2, name: 'One-time Purchase, No Subscription' },
    '3': { id: 3, name: 'Monthly Subscription (Bills on same date every month)' },
    '4': { id: 4, name: 'Annual Subscription' },
    '5': { id: 5, name: '30 Day Subscription' },
    '6': { id: 6, name: '60 Day Subscription' },
    '7': { id: 7, name: '90 Day Subscription' },
    '8': { id: 8, name: 'Weekly Subscription' }
};

describe('product stickyio decorator', function () {
    var stickyioProduct = proxyquire('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/product/decorators/stickyio.js', {
        '~/cartridge/scripts/stickyio': stickyioMocks
    });

    it('should create stickyio properties for passed in object', function () {
        var object = {};
        stickyioProduct(object, productMock);

        assert.equal(object.stickyio.id, '1');
        assert.equal(object.stickyio.stickyioBillingModelConsumerSelectable, true);
        assert.equal(object.stickyio.stickyioPID, 1);
        assert.equal(object.stickyio.stickyioVID, 1);
        assert.equal(object.stickyio.stickyioOID, '1');
        assert.equal(object.stickyio.stickyioBMID, null);
        assert.deepEqual(object.stickyio.stickyioProductBillingModels, billingModelMock);
        assert.equal(object.stickyio.stickyioproductCampaignID, '1');
        assert.equal(object.stickyio.stickyioProductWrapper, '1');
        assert.equal(object.stickyio.productType, 'master');
        assert.equal(object.stickyio.stickyioSubscriptionActive, true);
        assert.equal(object.stickyio.stickyioReady, true);
    });
});
