'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var productMock = {
    attributeModel: {},
    minOrderQuantity: { value: 'someValue' },
    availabilityModel: {},
    stepQuantity: { value: 'someOtherValue' },
    getPrimaryCategory: function () { return { custom: { sizeChartID: 'someID' } }; },
    getMasterProduct: function () {
        return {
            getPrimaryCategory: function () { return { custom: { sizeChartID: 'someID' } }; }
        };
    },
    ID: 'someID'
};

var optionsMock = {
    productType: 'someProductType',
    optionModel: {},
    quantity: 1,
    variationModel: {},
    promotions: [],
    variables: [],
    lineItem: {
        custom: { 
            stubStickyioBillingModelID: 123,
            stubStickyioBillingModelDetails: 'someBillingModelDetails',
            stubStickyioSubscriptionID: 'someSubscriptionID'
        }
    }
};

var object = {};

describe('Bonus Order Line Item', function () {
    module.__proto__.superModule = function () {
        return { items: [] }
    };

    var productDecorators = require('../../../../mocks/productDecoratorsMock');
    var productLineItemDecorators = require('../../../../mocks/productLineItemDecoratorsMock');

    var bonusOrderLineItem = proxyquire('../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/bonusOrderLineItem', {
        '*/cartridge/models/product/decorators/index': productDecorators.mocks,
        '~/cartridge/models/productLineItem/decorators/index': productLineItemDecorators.mocks
    });

    afterEach(function () {
        productLineItemDecorators.stubs.stubStickyioBillingModelID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelDetails.reset();
        productLineItemDecorators.stubs.stubStickyioSubscriptionID.reset();
    });

    it('should call stickyioBillingModelID for bonus line item model', function () {
        bonusOrderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelID.calledOnce);
    });

    it('should call stickyioBillingModelDetails for bonus line item model', function () {
        bonusOrderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelDetails.calledOnce);
    });

    it('should call stickyioSubscriptionID for bonus line item model', function () {
        bonusOrderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioSubscriptionID.calledOnce);
    });
});
