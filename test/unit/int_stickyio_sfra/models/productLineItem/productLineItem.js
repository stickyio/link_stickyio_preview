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
            stubStickyioProductID: 123,
            stubStickyioVariationID: 123,
            stubStickyioCampaignID: 123,
            stubStickyioOfferID: 123,
            stubStickyioTermsID: 'someString',
            stubStickyioBillingModelID: 123,
            stubStickyioBillingModelDetails: 'someBillingModelDetails'
        }
    }
};

var object = {};

describe('Product Line Item Model', function () {
    module.__proto__.superModule = function () {
        return { items: [] }
    };

    var productDecorators = require('../../../../mocks/productDecoratorsMock');
    var productLineItemDecorators = require('../../../../mocks/productLineItemDecoratorsMock');

    var productLineItem = proxyquire('../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/productLineItem', {
        '*/cartridge/models/product/decorators/index': productDecorators.mocks,
        '~/cartridge/models/productLineItem/decorators/index': productLineItemDecorators.mocks
    });

    afterEach(function () {
        productLineItemDecorators.stubs.stubStickyioProductID.reset();
        productLineItemDecorators.stubs.stubStickyioVariationID.reset();
        productLineItemDecorators.stubs.stubStickyioCampaignID.reset();
        productLineItemDecorators.stubs.stubStickyioOfferID.reset();
        productLineItemDecorators.stubs.stubStickyioTermsID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelDetails.reset();
    });

    it('should call stickyioProductID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioProductID.calledOnce);
    });

    it('should call stickyioVariationID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioVariationID.calledOnce);
    });

    it('should call stickyioCampaignID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioCampaignID.calledOnce);
    });

    it('should call stickyioOfferID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioOfferID.calledOnce);
    });

    it('should call stickyioTermsID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioTermsID.calledOnce);
    });

    it('should call stickyioBillingModelID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelID.calledOnce);
    });

    it('should call stickyioBillingModelDetails for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelDetails.calledOnce);
    });
});
