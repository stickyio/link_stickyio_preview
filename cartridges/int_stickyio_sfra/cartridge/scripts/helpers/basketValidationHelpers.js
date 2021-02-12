'use strict';

var collections = require('*/cartridge/scripts/util/collections');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

var ProductInventoryMgr = require('dw/catalog/ProductInventoryMgr');
var StoreMgr = require('dw/catalog/StoreMgr');
var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');
var stickyio;

/**
 * validates that the product line items exist, are online, have available inventory,
 * and, if a sticky.io-enabled subscription product, is still valid
 * @param {dw.order.Basket} basket - The current user's basket
 * @returns {Object} an error object
 */
function validateProducts(basket) {
    var result = {
        error: false,
        hasInventory: true
    };
    var productLineItems = basket.productLineItems;
    if (stickyioEnabled) { stickyio = require('~/cartridge/scripts/stickyio'); }

    collections.forEach(productLineItems, function (item) {
        if (item.product === null || !item.product.online) {
            result.error = true;
            return;
        }

        if (Object.hasOwnProperty.call(item.custom, 'fromStoreId')
            && item.custom.fromStoreId) {
            var store = StoreMgr.getStore(item.custom.fromStoreId);
            var storeInventory = ProductInventoryMgr.getInventoryList(store.custom.inventoryListId);

            result.hasInventory = result.hasInventory
                && (storeInventory.getRecord(item.productID)
                && storeInventory.getRecord(item.productID).ATS.value >= item.quantityValue);
        } else {
            var availabilityLevels = item.product.availabilityModel
                .getAvailabilityLevels(item.quantityValue);
            result.hasInventory = result.hasInventory
                && (availabilityLevels.notAvailable.value === 0);
        }

        if (stickyioEnabled && item.custom.stickyioBillingModelID) {
            if (!stickyio.validateLineItem(item)) { result.error = true; }
        }
    });

    return result;
}

/**
 * Validates coupons
 * @param {dw.order.Basket} basket - The current user's basket
 * @returns {Object} an error object
 */
function validateCoupons(basket) {
    var invalidCouponLineItem = collections.find(basket.couponLineItems, function (couponLineItem) {
        return !couponLineItem.valid;
    });

    return {
        error: !!invalidCouponLineItem
    };
}

module.exports = {
    validateProducts: validateProducts,
    validateCoupons: validateCoupons,
    validateShipments: COHelpers.ensureValidShipments
};
