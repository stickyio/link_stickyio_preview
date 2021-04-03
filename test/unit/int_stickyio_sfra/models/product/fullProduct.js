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
    ID: 'someID',
    pageTitle: 'some title',
    pageDescription: 'some description',
    pageKeywords: 'some keywords',
    pageMetaData: [{}],
    template: 'some template'
};

var optionsMock = {
    productType: 'someProductType',
    optionModel: {},
    quantity: 1,
    variationModel: {},
    promotions: [],
    variables: []
};

describe('Full Product Model', function () {
    module.__proto__.superModule = function () {
        return { items: [] }
    };
    
    var decorators = require('../../../../mocks/productDecoratorsMock');

    var fullProduct = proxyquire('../../../../../cartridges/int_stickyio_sfra/cartridge/models/product/fullProduct', {
        '~/cartridge/models/product/decorators/index': decorators.mocks
    });

    afterEach(function () {
        decorators.stubs.stubStickyio.reset();
    });

    it('should call stickyio for full product', function () {
        var object = {};
        fullProduct(object, productMock, optionsMock);

        assert.isTrue(decorators.stubs.stubStickyio.calledOnce);
    });
});
