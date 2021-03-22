'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var stickyioMocks = require('../../../../../mocks/stickyio');

var productMock = {
    custom: {
        stickyioSubscriptionActive: true,
        stickyioReady: true,
        stickyioOneTimePurchase: true,
        stickyioBillingModelConsumerSelectable: true,
        stickyioProductID: 1,
        stickyioVariationID: 1,
        stickyioOffer1: {
            value: '1',
            displayValue: 'Standard'
        },
        stickyioBillingModels1: [{
                value: '3',
                displayValue: '90 Days'
            },
            {
                value: '4',
                displayValue: 'Annually'
            }
        ],
        stickyioOffer2: {
            value: '2',
            displayValue: 'Prepaid Offer'
        },
        stickyioBillingModels2: [{
                value: '3',
                displayValue: '90 Days'
            },
            {
                value: '4',
                displayValue: 'Annually'
            }
        ],
        stickyioOffer3: {},
        stickyioCampaignID: 1
    },
    ID: '1',
    isVariant: function() {
        return false;
    }
};

var offers = {
    '1': {
        name: 'Standard',
        billingModels: [{
                id: '3',
                name: '90 Days'
            },
            {
                id: '4',
                name: 'Annually'
            }
        ]
    },
    '2': {
        name: 'Prepaid Offer',
        billingModels: [{
                id: '3',
                name: '90 Days'
            },
            {
                id: '4',
                name: 'Annually'
            }
        ],
        terms: [{
            cycles: 3,
            description: '3 cycles at 20% off',
            id: '2-3'
        }]
    }
};

var Resource = {
    repo: {
        'stickyio' : {
            resources: {
                'productdetail.currencysymbol.USD': '$',
                'productdetail.cycles': 'cycles',
                'productdetail.cycles.at': 'at',
                'productdetail.cycles.off': 'off'
            }
        }
    },
    msg: function(resource, repo, defaultResponse) {
        return Resource.repo[repo].resources[resource] ? Resource.repo[repo].resources[resource] : defaultResponse;
    }
};

var Site = {
    getCurrent: function() {
        getDefaultCurrency: getDefaultCurrency()
    }
};

var getDefaultCurrency = {
    getDefaultCurrency: function() { return 'USD'; }
}

describe('product stickyio decorator', function() {
    var stickyioProduct = proxyquire('../../../../../../cartridges/int_stickyio_sfra/cartridge/models/product/decorators/stickyio.js', {
        '~/cartridge/scripts/stickyio': stickyioMocks,
        'dw/web/Resource': Resource,
        'dw/system/Site': Site,
    });

    it('should create stickyio properties for passed in object', function() {
        var object = {};
        stickyioProduct(object, productMock);
        console.log(object.stickyio);

        assert.equal(object.stickyio.id, '1');
        assert.equal(object.stickyio.stickyioBillingModelConsumerSelectable, true);
        assert.equal(object.stickyio.stickyioPID, 1);
        assert.equal(object.stickyio.stickyioVID, 1);
        assert.equal(object.stickyio.stickyioBMID, null);
        assert.equal(object.stickyio.stickyioCID, '1');
        assert.deepEqual(object.stickyio.offers, offers);
        assert.equal(object.stickyio.stickyioProductWrapper, '1');
        assert.equal(object.stickyio.productType, 'master');
        assert.equal(object.stickyio.stickyioOneTimePurchase, true);
        assert.equal(object.stickyio.stickyioSubscriptionActive, true);
        assert.equal(object.stickyio.stickyioReady, true);
    });
});