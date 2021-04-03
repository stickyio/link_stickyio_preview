'use strict';

var base = module.superModule;
var productLineItemDecorators = require('~/cartridge/models/productLineItem/decorators/index');

/**
 * Decorate product with product line item information
 * @param {Object} product - Product Model to be decorated
 * @param {dw.catalog.Product} apiProduct - Product information returned by the script API
 * @param {Object} options - Options passed in from the factory
 * @property {dw.catalog.ProductVarationModel} options.variationModel - Variation model returned by the API
 * @property {Object} options.lineItemOptions - Options provided on the query string
 * @property {dw.catalog.ProductOptionModel} options.currentOptionModel - Options model returned by the API
 * @property {dw.util.Collection} options.promotions - Active promotions for a given product
 * @property {number} options.quantity - Current selected quantity
 * @property {Object} options.variables - Variables passed in on the query string
 *
 * @returns {Object} - Decorated product model
 */
module.exports = function bonusOrderLineItem(product, apiProduct, options) {
    base.call(this, product, apiProduct, options);
    productLineItemDecorators.stickyioOfferID(product, options.lineItem);
    productLineItemDecorators.stickyioTermsID(product, options.lineItem);
    productLineItemDecorators.stickyioBillingModelID(product, options.lineItem);
    productLineItemDecorators.stickyioBillingModelDetails(product, options.lineItem);
    productLineItemDecorators.stickyioSubscriptionID(product, options.lineItem);

    return product;
};
