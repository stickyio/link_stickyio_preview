/**
 * Business Manager extension endpoints
 */

'use strict';

var server = require('server');
var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');

/**
 * sticky.io order management iframe
 * @returns {void}
 */
server.get('OrderManagement', function (req, res, next) {
    var url = stickyio.sso('orders.php', 'CSR');
    var pdict = {};
    pdict.url = url;
    res.render('stickyio/orderManagement', pdict);
    next();
});

/**
 * sticky.io analytics iframe
 * @returns {void}
 */
server.get('Analytics', function (req, res, next) {
    var pdict = {};
    var params = {};
    params.id = 'dashboards';
    params.helper = '4420';
    var stickyioResponse = stickyio.stickyioAPI('stickyio.http.get.analytics.dashboards').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
        pdict.url = stickyioResponse.object.result.data.iframe_url;
    }
    res.render('stickyio/analytics', pdict);
    next();
});

/**
 * sticky.io offers iFrame
 * @returns {void}
 */
server.get('CustomOffer', function (req, res, next) {
    var url = stickyio.sso('billing_models/campaign.php', 'ConfigUser');
    var pdict = {};
    pdict.url = url;
    res.render('stickyio/customOffer', pdict);
    next();
});

/**
 * shortcut to the custom preferences of the site
 * @returns {void}
 */
server.get('Prefs', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    var csrfProtection = require('dw/web/CSRFProtection');
    var url = URLUtils.url('ViewApplication-BM', 'csrf_token', csrfProtection.generateToken());
    res.redirect(url + '#/?preference#site_preference_group_attributes!id!STICKYIO');
    next();
});

/**
 * business manager product configuration page
 * @returns {void}
 */
server.get('ProductConfig', function (req, res, next) {
    stickyio.validateAllProducts();
    var stickyioCampaigns = stickyio.getCampaignCustomObjectJSON();
    var response = {};
    response.noCustoms = true;
    // determine if there are already custom offers/billing models. if not, direct Merchant to go set that up
    response.numOffers = Object.keys(stickyioCampaigns.campaigns['1'].offers).length;
    if (response.numOffers > 1) {
        response.numOffers--;
        response.noCustoms = false;
    } else {
        response.numOffers = (0).toFixed(0);
    }
    response.stickyioCampaigns = stickyioCampaigns;
    response.customOfferProducts = stickyio.getCustomOfferProducts();
    if (req.querystring.pid !== '') {
        var ProductMgr = require('dw/catalog/ProductMgr');
        var product = ProductMgr.getProduct(req.querystring.pid);
        if (product && product.custom.stickyioOfferID.value === '0') {
            var SystemObjectMgr = require('dw/object/SystemObjectMgr');
            var productAvailableBillingModels = [];
            var i;
            for (i = 0; i < product.custom.stickyioCustomBillingModels.length; i++) {
                productAvailableBillingModels.push(product.custom.stickyioCustomBillingModels[i]);
            }
            var maxOfferID = 0;
            var existingOffers = SystemObjectMgr.describe('Product').getCustomAttributeDefinition('stickyioOfferID');
            for (i = 0; i < existingOffers.values.length; i++) {
                if (existingOffers.values[i].value > maxOfferID) {
                    maxOfferID = parseInt(existingOffers.values[i].value, 10);
                }
            }
            response.product = product;
            response.productCampaignData = stickyioCampaigns.campaignProducts[product.ID];
            response.productAvailableBillingModels = productAvailableBillingModels;
            response.packagedOffersMaxID = maxOfferID;
        }
    }
    res.render('stickyio/productConfig', response);
    next();
});

/**
 * get sticky.io campaigns
 * @returns {boolean} - boolean response
 */
server.get('GetCampaigns', function (req, res, next) {
    res.json(stickyio.getCampaigns());
    next();
});

/**
 * get sticky.io product
 * @returns {Object} - JSON response
 */
server.get('GetProduct', function (req, res, next) {
    res.json(stickyio.getProduct(true, req.querystring.pid));
    next();
});

/**
 * save sticky.io product
 * @returns {Object} - JSON response
 */
server.post('SaveProduct', function (req, res, next) {
    res.json(stickyio.saveProduct(request.httpParameterMap)); // eslint-disable-line no-undef
    next();
});

module.exports = server.exports();
