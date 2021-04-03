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
        UUID: '123',
        custom: { 
            stubStickyioBillingModelID: 123,
            stubStickyioBillingModelDetails: 'someBillingModelDetails',
            stubStickyioSuscriptionID: 'someSuscriptionID'
        }
    }
};

var object = {};

describe('Order Line Item Model', function () {
    module.__proto__.superModule = function () {
        return { items: [] }
    };

    var productDecorators = require('../../../../mocks/productDecoratorsMock');
    var productLineItemDecorators = require('../../../../mocks/productLineItemDecoratorsMock');

    var orderLineItem = proxyquire('../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/orderLineItem', {
        '*/cartridge/models/product/decorators/index': productDecorators.mocks,
        '~/cartridge/models/productLineItem/decorators/index': productLineItemDecorators.mocks
    });

    afterEach(function () {
        productLineItemDecorators.stubs.stubStickyioBillingModelID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelDetails.reset();
        productLineItemDecorators.stubs.stubStickyioSubscriptionID.reset();
    });

    it('should call stickyioBillingModelID for order line item model', function () {
        orderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelID.calledOnce);
    });

    it('should call stickyioBillingModelDetails for order line item model', function () {
        orderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelDetails.calledOnce);
    });

    it('should call stickyioSubscriptionID for order line item model', function () {
        orderLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioSubscriptionID.calledOnce);
    });
});
