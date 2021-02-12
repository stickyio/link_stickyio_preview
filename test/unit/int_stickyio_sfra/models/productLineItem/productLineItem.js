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
            stubStickyioBillingModelID: 123,
            stubStickyioBillingModelDetails: 'someBillingModelDetails'
        }
    }
};

var object = {};

describe('Product Line Item Model', function () {
    var productDecorators = require('../../../../mocks/productDecoratorsMock');
    var productLineItemDecorators = require('../../../../mocks/productLineItemDecoratorsMock');

    var productLineItem = proxyquire('../../../../../cartridges/int_stickyio_sfra/cartridge/models/productLineItem/productLineItem', {
        '*/cartridge/models/product/decorators/index': productDecorators.mocks,
        '~/cartridge/models/productLineItem/decorators/index': productLineItemDecorators.mocks
    });

    afterEach(function () {
        productDecorators.stubs.stubBase.reset();
        productDecorators.stubs.stubPrice.reset();
        productDecorators.stubs.stubImages.reset();
        productDecorators.stubs.stubAvailability.reset();
        productDecorators.stubs.stubDescription.reset();
        productDecorators.stubs.stubSearchPrice.reset();
        productDecorators.stubs.stubPromotions.reset();
        productDecorators.stubs.stubQuantity.reset();
        productDecorators.stubs.stubQuantitySelector.reset();
        productDecorators.stubs.stubRatings.reset();
        productDecorators.stubs.stubSizeChart.reset();
        productDecorators.stubs.stubVariationAttributes.reset();
        productDecorators.stubs.stubSearchVariationAttributes.reset();
        productDecorators.stubs.stubAttributes.reset();
        productDecorators.stubs.stubOptions.reset();
        productDecorators.stubs.stubCurrentUrl.reset();
        productDecorators.stubs.stubReadyToOrder.reset();
        productDecorators.stubs.stubSetReadyToOrder.reset();
        productDecorators.stubs.stubBundleReadyToOrder.reset();
        productDecorators.stubs.stubSetIndividualProducts.reset();
        productDecorators.stubs.stubBundledProducts.reset();
        productLineItemDecorators.stubs.stubQuantity.reset();
        productLineItemDecorators.stubs.stubGift.reset();
        productLineItemDecorators.stubs.stubAppliedPromotions.reset();
        productLineItemDecorators.stubs.stubRenderedPromotions.reset();
        productLineItemDecorators.stubs.stubUuid.reset();
        productLineItemDecorators.stubs.stubOrderable.reset();
        productLineItemDecorators.stubs.stubShipment.reset();
        productLineItemDecorators.stubs.stubBonusProductLineItem.reset();
        productLineItemDecorators.stubs.stubPriceTotal.reset();
        productLineItemDecorators.stubs.stubQuantityOptions.reset();
        productLineItemDecorators.stubs.stubOptions.reset();
        productLineItemDecorators.stubs.stubStickyioProductID.reset();
        productLineItemDecorators.stubs.stubStickyioVariationID.reset();
        productLineItemDecorators.stubs.stubStickyioCampaignID.reset();
        productLineItemDecorators.stubs.stubStickyioOfferID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelID.reset();
        productLineItemDecorators.stubs.stubStickyioBillingModelDetails.reset();
    });

    it('should call base for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productDecorators.stubs.stubBase.calledOnce);
    });

    it('should call price for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productDecorators.stubs.stubPrice.calledOnce);
    });

    it('should call images for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productDecorators.stubs.stubImages.calledOnce);
    });

    it('should call variationAttributes for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productDecorators.stubs.stubVariationAttributes.calledOnce);
    });

    it('should call availability for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productDecorators.stubs.stubAvailability.calledOnce);
    });

    it('should call quantity for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubQuantity.calledOnce);
    });

    it('should call gift for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubGift.calledOnce);
    });

    it('should call appliedPromotions for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubAppliedPromotions.calledOnce);
    });

    it('should call renderedPromotions for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubRenderedPromotions.calledOnce);
    });

    it('should call uuid for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubUuid.calledOnce);
    });

    it('should call orderable for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubOrderable.calledOnce);
    });

    it('should call shipment for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubShipment.calledOnce);
    });

    it('should call bonusProductLineItem for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubBonusProductLineItem.calledOnce);
    });

    it('should call priceTotal for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubPriceTotal.calledOnce);
    });

    it('should call quantityOptions for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubQuantityOptions.calledOnce);
    });

    it('should call options for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubOptions.calledOnce);
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

    it('should call stickyioBillingModelID for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelID.calledOnce);
    });

    it('should call stickyioBillingModelDetails for product line item model', function () {
        productLineItem(object, productMock, optionsMock);

        assert.isTrue(productLineItemDecorators.stubs.stubStickyioBillingModelDetails.calledOnce);
    });
});
