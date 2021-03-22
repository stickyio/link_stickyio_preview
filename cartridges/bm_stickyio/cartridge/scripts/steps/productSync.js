'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');
var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio'); // hard-coded path to shared sticky.io library

exports.productSync = function (parameters) {
    var products = ProductMgr.queryAllSiteProducts();
    var allStickyioProducts = stickyio.getAllStickyioMasterProducts();

    while (products.hasNext()) {
        var product = products.next();
        stickyio.syncProduct(product, allStickyioProducts, parameters['Reset All Products'], parameters['Persist Product IDs'], false);
    }

    // first-time run setup, but checked on each sync just in case.
    stickyio.createStraightSaleProduct(parameters['Wipe Preferences']);
    stickyio.createCustomField('stickyioCustomFieldSiteID', 'SFCC Site ID', 'site_id', 1, 2, parameters['Wipe Preferences']);
    stickyio.createCustomField('stickyioCustomFieldOrderNo', 'SFCC Order Number', 'order_number', 1, 2, parameters['Wipe Preferences']);
    stickyio.createCustomField('stickyioCustomFieldShipmentID', 'SFCC Shipment ID', 'shipment_id', 1, 2, parameters['Wipe Preferences']);
    stickyio.createCustomField('stickyioCustomFieldCustomerID', 'SFCC Customer ID', 'customer_id', 1, 2, parameters['Wipe Preferences']);
    stickyio.createCustomField('stickyioCustomFieldOrderToken', 'SFCC Order Token', 'order_token', 1, 2, parameters['Wipe Preferences']);

    var content = '';
    if (Object.keys(stickyio.subscriptionProductsLog).length > 0 || stickyio.offerProductsLog.length > 0) {
        if (Object.keys(stickyio.subscriptionProductsLog).length > 0) {
            content += Object.keys(stickyio.subscriptionProductsLog).length + ' subscription product(s) synced:\n';
            content += JSON.stringify(stickyio.subscriptionProductsLog, null, '\t') + '\n';
        }
        if (stickyio.offerProductsLog.length > 0) {
            content += stickyio.offerProductsLog.length + ' Offer(s) synced:\n';
            content += JSON.stringify(stickyio.offerProductsLog, null, '\t');
        }
        if (parameters['Email Log'] && parameters['Email Address'] !== '') {
            stickyio.sendNotificationEmail(parameters['Email Address'].toString(), content, 'Product Sync Output');
        }
    }
};
