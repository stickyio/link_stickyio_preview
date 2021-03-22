/**
 * Append subscription options to a product
 */

'use strict';

var Product = module.superModule;
var server = require('server');
server.extend(Product);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

if (stickyioEnabled) {
    var stickyioHelper = require('~/cartridge/scripts/helpers/stickyioHelpers');

    server.append('Show', function (req, res, next) {
        var viewData = res.getViewData();
        if (viewData.product) {
            if (viewData.product.productType === 'set') {
                var i;
                for (i = 0; i < viewData.product.individualProducts.length; i++) {
                    viewData.product.individualProducts[i] = stickyioHelper.setBaseURLAndBMID(viewData.product.individualProducts[i].id, req.querystring, viewData.product.individualProducts[i]);
                }
            } else {
                viewData.product = stickyioHelper.setBaseURLAndBMID(viewData.product.id, req.querystring, viewData.product);
            }
            res.setViewData(viewData);
        }
        return next();
    });

    server.append('ShowQuickView', function (req, res, next) {
        var viewData = res.getViewData();
        if (viewData.product) {
            if (viewData.product.productType === 'set') {
                var i;
                for (i = 0; i < viewData.product.individualProducts.length; i++) {
                    viewData.product.individualProducts[i] = stickyioHelper.setBaseURLAndBMID(viewData.product.individualProducts[i].id, req.querystring, viewData.product.individualProducts[i]);
                }
            } else {
                viewData.product = stickyioHelper.setBaseURLAndBMID(viewData.product.id, req.querystring, viewData.product);
            }
            res.setViewData(viewData);
        }
        return next();
    });


    server.append('Variation', function (req, res, next) {
        var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');
        var viewData = res.getViewData();
        if (viewData.product) {
            viewData.product = stickyioHelper.setBaseURLAndBMID(viewData.product.id, req.querystring, viewData.product);
            if (viewData.product.stickyio.stickyioReady) {
                var attributeTemplate = 'stickyio/stickyioProduct';
                viewData.product.stickyioHTML = renderTemplateHelper.getRenderedHtml(
                    viewData.product,
                    attributeTemplate
                );
            }
            res.setViewData(viewData);
        }
        return next();
    });
}

module.exports = server.exports();
