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
    pdict.type = 'order';
    res.render('stickyio/manage', pdict);
    next();
});

/**
 * sticky.io offers iframe
 * @returns {void}
 */
server.get('Offer', function (req, res, next) {
    var url = stickyio.sso('billing_models/campaign.php', 'ConfigUser');
    var pdict = {};
    pdict.url = url;
    pdict.type = 'offer';
    res.render('stickyio/manage', pdict);
    next();
});

/**
 * sticky.io billing models iframe
 * @returns {void}
 */
server.get('BillingModel', function (req, res, next) {
    var url = stickyio.sso('billing_models/index.php', 'ConfigUser');
    var pdict = {};
    pdict.url = url;
    pdict.type = 'billingModel';
    res.render('stickyio/manage', pdict);
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
    pdict.type = 'analytics';
    res.render('stickyio/manage', pdict);
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
 * sticky.io order note templates iframe
 * @returns {void}
 */
server.get('OrderNoteTemplates', function (req, res, next) {
    var url = stickyio.sso('notes/index.php', 'ConfigUser');
    var pdict = {};
    pdict.url = url;
    pdict.type = 'orderNoteTemplates';
    res.render('stickyio/manage', pdict);
    next();
});

server.get('MultiCurrency', function (req, res, next) {
    var Site = require('dw/system/Site');
    var pdict = {};
    pdict.type = 'multiCurrencySettings';

    pdict.locales = Site.getCurrent().allowedLocales;
    pdict.currencies = Site.getCurrent().allowedCurrencies;
    pdict.stickyioMultiCurrencyOptions = Site.getCurrent().getCustomPreferenceValue('stickyioMultiCurrencyOptions');
    pdict.stickyioGatewayID = Site.getCurrent().getCustomPreferenceValue('stickyioGatewayID');

    res.render('stickyio/multicurrency', pdict);
    next();
});

server.post('MultiCurrency-UpdatePreference', function (req, res, next) {
    var txn = require('dw/system/Transaction');
    var Site = require('dw/system/Site');
    var pdict = {};

    txn.wrap(function () {
        Site.getCurrent().setCustomPreferenceValue('stickyioMultiCurrencyOptions', req.querystring.stickyioMultiCurrencyOptions);
        pdict.stickyioMultiCurrencyOptions = Site.getCurrent().getCustomPreferenceValue('stickyioMultiCurrencyOptions');
    });

    res.json(pdict);
    next();
});

server.post('UpdatePreference-GatewayId', function (req, res, next) {
    var txn = require('dw/system/Transaction');
    var Site = require('dw/system/Site');
    var pdict = {};

    txn.wrap(function () {
        // eslint-disable-next-line radix
        Site.getCurrent().setCustomPreferenceValue('stickyioGatewayID', parseInt(req.querystring.stickyioGatewayID));
        pdict.stickyioGatewayID = Site.getCurrent().getCustomPreferenceValue('stickyioGatewayID');
    });

    res.json(pdict);
    next();
});

server.get('ProductGroups', function (req, res, next) {
    var Site = require('dw/system/Site');
    var siteId = Site.getCurrent().ID;
    var url = stickyio.sso('products_group/index.php?SFCC-Site-Id=' + siteId, 'ConfigUser');
    var pdict = {};
    pdict.type = 'productGroups';
    pdict.url = url;
    res.render('stickyio/manage', pdict);
    next();
});

module.exports = server.exports();
