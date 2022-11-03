/**
 * Extended productLineItem model necesitates the modification of functions
 * within this file.
 */

'use strict';

var base = module.superModule;
var ProductMgr = require('dw/catalog/ProductMgr');
var Resource = require('dw/web/Resource');

var collections = require('*/cartridge/scripts/util/collections');
var productHelper = require('*/cartridge/scripts/helpers/productHelpers');

/**
 * @typedef SelectedOption
 * @type Object
 * @property {string} optionId - Option ID
 * @property {Object} selectedValueId - Selected option value ID
 */

/**
 * Determines whether a product's current options are the same as those just selected
 *
 * @param {dw.util.Collection} existingOptions - Options currently associated with this product
 * @param {SelectedOption[]} selectedOptions - Product options just selected
 * @return {boolean} - Whether a product's current options are the same as those just selected
 */
base.hasSameOptions = function (existingOptions, selectedOptions) {
    var newOptions = [];
    var i;
    var j;
    for (i = selectedOptions.length - 1; i >= 0; i--) {
        if (selectedOptions[i].optionId !== 'stickyioBillingModelOptions' && selectedOptions[i].optionId !== 'stickyioOfferOptions' && selectedOptions[i].optionId !== 'stickyioTermOptions') {
            newOptions.push(selectedOptions[i]);
        }
    }
    var selected = {};
    for (i = 0, j = newOptions.length; i < j; i++) {
        selected[newOptions[i].optionId] = newOptions[i].selectedValueId;
    }
    return collections.every(existingOptions, function (option) {
        if (option.optionID === 'stickyioBillingModelOptions' || option.optionID === 'stickyioOfferOptions' || option.optionID === 'stickyioTermOptions') {
            return true;
        }
        return option.optionValueID === selected[option.optionID];
    });
};

/**
 * Determines whether a product's current sticky.io Billing Model are the same as those just selected
 *
 * @param {number} stickyioBillingModelIDExisting - sticky.io Billing Model ID currently associated with this product
 * @param {number} stickyioBillingModelIDSelected - sticky.io Billing Model ID just selected
 * @return {boolean} - Whether a product's current sticky.io Billing Model ID is the same as those just selected
 */
base.hasSameStickyioBillingModel = function (stickyioBillingModelIDExisting, stickyioBillingModelIDSelected) {
    if (stickyioBillingModelIDExisting) {
        return stickyioBillingModelIDExisting.toString() === stickyioBillingModelIDSelected.toString();
    }
    return false;
};

/**
 * Determines whether a product's current sticky.io prepaid terms are the same as those just selected
 *
 * @param {string} stickyioTermsIDExisting - sticky.io term ID currently associated with this product
 * @param {string} stickyioTermsIDSelected - sticky.io term ID just selected
 * @return {boolean} - Whether a product's current sticky.io Term ID is the same as those just selected
 */
base.hasSameStickyioTerms = function (stickyioTermsIDExisting, stickyioTermsIDSelected) {
    if (stickyioTermsIDExisting) {
        return stickyioTermsIDExisting === stickyioTermsIDSelected;
    }
    return false;
};

/**
 * Adds a line item for this product to the Cart
 *
 * @param {dw.order.Basket} currentBasket -
 * @param {dw.catalog.Product} product -
 * @param {number} quantity - Quantity to add
 * @param {string[]}  childProducts - the products' sub-products
 * @param {dw.catalog.ProductOptionModel} optionModel - the product's option model
 * @param {dw.order.Shipment} defaultShipment - the cart's default shipment method
 * @param {number} stickyioProductID - sticky.io Product ID
 * @param {number} stickyioVariationID - sticky.io Variation ID
 * @param {number} stickyioCampaignID - sticky.io Campaign ID
 * @param {number} stickyioOfferID - sticky.io Offer ID
 * @param {string} stickyioTermsID - sticky.io Term ID
 * @param {number} stickyioBillingModelID - sticky.io Offer ID
 * @param {string[]} stickyioBillingModelDetails - sticky.io Offer details
 * @return {dw.order.ProductLineItem} - The added product line item
 */
base.addLineItem = function (
    currentBasket,
    product,
    quantity,
    childProducts,
    optionModel,
    defaultShipment,
    stickyioProductID,
    stickyioVariationID,
    stickyioCampaignID,
    stickyioOfferID,
    stickyioTermsID,
    stickyioBillingModelID,
    stickyioBillingModelDetails
) {
    var thisOptionModel = optionModel;
    var options = [];
    if (thisOptionModel.options.length > 0) {
        var i;
        for (i = 0; i < thisOptionModel.options.length; i++) {
            if (thisOptionModel.options[i].ID === 'stickyioBillingModelOptions') {
                options.push({
                    optionId: thisOptionModel.options[i].ID,
                    selectedValueId: Number(stickyioBillingModelID)
                });
            }
            if (thisOptionModel.options[i].ID === 'stickyioTermOptions') {
                options.push({
                    optionId: thisOptionModel.options[i].ID,
                    selectedValueId: stickyioTermsID
                });
            }
            if (thisOptionModel.options[i].ID === 'stickyioOfferOptions') {
                options.push({
                    optionId: thisOptionModel.options[i].ID,
                    selectedValueId: Number(stickyioOfferID)
                });
            }
        }
        if (options.length > 0) {
            thisOptionModel = productHelper.getCurrentOptionModel(product.optionModel, options);
        }
    }
    var productLineItem = currentBasket.createProductLineItem(
        product,
        thisOptionModel,
        defaultShipment
    );

    productLineItem.setQuantityValue(quantity);

    if (stickyioProductID) {
        productLineItem.custom.stickyioProductID = Number(stickyioProductID);
    }
    if (stickyioVariationID) {
        productLineItem.custom.stickyioVariationID = Number(stickyioVariationID);
    }
    if (stickyioCampaignID) {
        productLineItem.custom.stickyioCampaignID = Number(stickyioCampaignID);
    }
    if (stickyioOfferID) {
        productLineItem.custom.stickyioOfferID = Number(stickyioOfferID);
    }
    if (stickyioTermsID) {
        productLineItem.custom.stickyioTermsID = stickyioTermsID;
    }
    if (stickyioBillingModelID) {
        productLineItem.custom.stickyioBillingModelID = Number(stickyioBillingModelID);
    }
    if (stickyioBillingModelDetails) {
        productLineItem.custom.stickyioBillingModelDetails = stickyioBillingModelDetails;
    }

    return productLineItem;
};

/**
 * Filter all the product line items matching productId and
 * has the same bundled items or options in the cart
 * @param {dw.catalog.Product} product - Product object
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {number} stickyioBillingModelID - stickyioBillingModelID
 * @param {string} stickyioTermsID - stickyioTermsID
 * @return {dw.order.ProductLineItem[]} - Filtered all the product line item matching productId and
 *     has the same bundled items or options
 */
base.getExistingProductLineItemsInCart = function (product, productId, productLineItems, childProducts, options, stickyioBillingModelID, stickyioTermsID) {
    var matchingProductsObj = base.getMatchingProducts(productId, productLineItems);
    var matchingProducts = matchingProductsObj.matchingProducts;
    var productLineItemsInCart = matchingProducts.filter(function (matchingProduct) {
        if (product.bundle) {
            return base.allBundleItemsSame(matchingProduct.bundledProductLineItems, childProducts);
        }
        if (base.hasSameOptions(matchingProduct.optionProductLineItems, options || [])) {
            if (!stickyioBillingModelID) {
                return true;
            }
            return base.hasSameStickyioBillingModel(matchingProduct.custom.stickyioBillingModelID, stickyioBillingModelID) && base.hasSameStickyioTerms(matchingProduct.custom.stickyioTermsID, stickyioTermsID);
        }
        return [];
    });

    return productLineItemsInCart;
};

/**
 * Filter the product line item matching productId and
 * has the same bundled items or options in the cart
 * @param {dw.catalog.Product} product - Product object
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {number} stickyioBillingModelID - stickyioBillingModelID
 * @param {string} stickyioTermsID - stickyioTermsID
 * @return {dw.order.ProductLineItem} - get the first product line item matching productId and
 *     has the same bundled items or options
 */
base.getExistingProductLineItemInCart = function (product, productId, productLineItems, childProducts, options, stickyioBillingModelID, stickyioTermsID) {
    return base.getExistingProductLineItemsInCart(product, productId, productLineItems, childProducts, options, stickyioBillingModelID, stickyioTermsID)[0];
};

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} currentBasket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {number} stickyioProductID - sticky.io Subscription Product ID
 * @param {number} stickyioVariationID - sticky.io Subscription Variation ID
 * @param {number} stickyioCampaignID - sticky.io Subscription Campaign ID
 * @param {number} stickyioOfferID - sticky.io Subscription Offer ID
 * @param {string} stickyioTermsID - sticky.io Prepaid Term ID
 * @param {number} stickyioBillingModelID - sticky.io Subscription BillingModel ID
 * @param {string[]} stickyioBillingModelDetails - sticky.io Offer details
 *  @return {Object} returns an error object
 */
base.addProductToCart = function (currentBasket, productId, quantity, childProducts, options, stickyioProductID, stickyioVariationID, stickyioCampaignID, stickyioOfferID, stickyioTermsID, stickyioBillingModelID, stickyioBillingModelDetails) {
    var availableToSell;
    var defaultShipment = currentBasket.defaultShipment;
    var perpetual;
    var product = ProductMgr.getProduct(productId);
    var productInCart;
    var productLineItems = currentBasket.productLineItems;
    var productQuantityInCart;
    var quantityToSet;
    if (stickyioBillingModelID) {
        options.push({
            optionId: 'stickyioBillingModelOptions',
            selectedValueId: Number(stickyioBillingModelID)
        });
    }
    if (stickyioTermsID) {
        options.push({
            optionId: 'stickyioTermOptions',
            selectedValueId: stickyioTermsID
        });
    }
    if (stickyioOfferID) {
        options.push({
            optionId: 'stickyioOfferOptions',
            selectedValueId: Number(stickyioOfferID)
        });
    }
    var optionModel = productHelper.getCurrentOptionModel(product.optionModel, options);
    var result = {
        error: false,
        message: Resource.msg('text.alert.addedtobasket', 'product', null)
    };

    var totalQtyRequested = 0;
    var canBeAdded = false;

    if (product.bundle) {
        canBeAdded = base.checkBundledProductCanBeAdded(childProducts, productLineItems, quantity);
    } else {
        totalQtyRequested = quantity + base.getQtyAlreadyInCart(productId, productLineItems);
        perpetual = product.availabilityModel.inventoryRecord.perpetual;
        canBeAdded =
            (perpetual ||
                totalQtyRequested <= product.availabilityModel.inventoryRecord.ATS.value);
    }

    if (!canBeAdded) {
        result.error = true;
        result.message = Resource.msgf(
            'error.alert.selected.quantity.cannot.be.added.for',
            'product',
            null,
            product.availabilityModel.inventoryRecord.ATS.value,
            product.name
        );
        return result;
    }

    productInCart = base.getExistingProductLineItemInCart(
        product, productId, productLineItems, childProducts, options, stickyioBillingModelID, stickyioTermsID);

    if (productInCart) {
        productQuantityInCart = productInCart.quantity.value;
        quantityToSet = quantity ? quantity + productQuantityInCart : productQuantityInCart + 1;
        availableToSell = productInCart.product.availabilityModel.inventoryRecord.ATS.value;

        if (availableToSell >= quantityToSet || perpetual) {
            productInCart.setQuantityValue(quantityToSet);
            result.uuid = productInCart.UUID;
        } else {
            result.error = true;
            result.message = availableToSell === productQuantityInCart ?
                Resource.msg('error.alert.max.quantity.in.cart', 'product', null) :
                Resource.msg('error.alert.selected.quantity.cannot.be.added', 'product', null);
        }
    } else {
        var productInCartNoSticky = base.getExistingProductLineItemInCart(product, productId, productLineItems, childProducts, options, null, null);
        var productLineItem;
        if (productInCartNoSticky) { // this is the same product, but with a different stickyio billing model/offer/terms, so replace it
            currentBasket.removeProductLineItem(productInCartNoSticky);
            productLineItem = base.addLineItem(
                currentBasket,
                product,
                productInCartNoSticky.quantity.value,
                childProducts,
                optionModel,
                defaultShipment,
                stickyioProductID,
                stickyioVariationID,
                stickyioCampaignID,
                stickyioOfferID,
                stickyioTermsID,
                stickyioBillingModelID,
                stickyioBillingModelDetails
            );
        } else { // truly a new product
            productLineItem = base.addLineItem(
                currentBasket,
                product,
                quantity,
                childProducts,
                optionModel,
                defaultShipment,
                stickyioProductID,
                stickyioVariationID,
                stickyioCampaignID,
                stickyioOfferID,
                stickyioTermsID,
                stickyioBillingModelID,
                stickyioBillingModelDetails
            );
        }

        result.uuid = productLineItem.UUID;
    }

    return result;
};

module.exports = base;
