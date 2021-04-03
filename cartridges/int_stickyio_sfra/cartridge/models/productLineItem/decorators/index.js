'use strict';

var productLineItemDecoratorsIndex = module.superModule;

productLineItemDecoratorsIndex.stickyioProductID = require('~/cartridge/models/productLineItem/decorators/stickyioProductID');
productLineItemDecoratorsIndex.stickyioVariationID = require('~/cartridge/models/productLineItem/decorators/stickyioVariationID');
productLineItemDecoratorsIndex.stickyioCampaignID = require('~/cartridge/models/productLineItem/decorators/stickyioCampaignID');
productLineItemDecoratorsIndex.stickyioOfferID = require('~/cartridge/models/productLineItem/decorators/stickyioOfferID');
productLineItemDecoratorsIndex.stickyioTermsID = require('~/cartridge/models/productLineItem/decorators/stickyioTermsID');
productLineItemDecoratorsIndex.stickyioBillingModelID = require('~/cartridge/models/productLineItem/decorators/stickyioBillingModelID');
productLineItemDecoratorsIndex.stickyioBillingModelDetails = require('~/cartridge/models/productLineItem/decorators/stickyioBillingModelDetails');
productLineItemDecoratorsIndex.stickyioSubscriptionID = require('~/cartridge/models/productLineItem/decorators/stickyioSubscriptionID');

module.exports = productLineItemDecoratorsIndex;
