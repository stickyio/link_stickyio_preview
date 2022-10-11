'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');
var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio'); // hard-coded path to shared sticky.io library

exports.productSync = function (parameters) {
    var products = ProductMgr.queryAllSiteProducts();
    var allStickyioProducts = stickyio.getAllStickyioMasterProducts();

    let productBundles = [];
    while (products.hasNext()) {
        var product = products.next();

        // Sync all single products first
        if (product.isBundle()) {
            productBundles.push(product);
        } else {
            stickyio.syncProduct(product, allStickyioProducts, parameters['Reset All Products'], parameters['Persist Product IDs'], false);
        }
    }

    // Sync product bundles
    if (productBundles.length > 0) {
        for (let i = 0; i < productBundles.length; i++) {
            let productBundle = productBundles[i];
            stickyio.syncProduct(productBundle, allStickyioProducts, parameters['Reset All Products'], parameters['Persist Product IDs'], false);
        }
    }

    stickyio.createStraightSaleProduct();

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
