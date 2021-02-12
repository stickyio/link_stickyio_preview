'use strict';

var Checkout = module.superModule;
var server = require('server');
server.extend(Checkout);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');
var stickyioForceRegisteredCheckout = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioForceRegisteredCheckout');

if (stickyioEnabled) {
    var stickyio = require('~/cartridge/scripts/stickyio');

    server.append(
        'Login',
        function (req, res, next) {
            var checkoutView = res.getViewData();
            if (stickyio.hasSubscriptionProducts() !== false) {
                checkoutView.stickyioForceRegisteredCheckout = stickyioForceRegisteredCheckout;
                checkoutView.stickyioOrder = true;
            }
            res.setViewData(checkoutView);

            return next();
        }
    );

    server.append(
        'Begin',
        function (req, res, next) {
            var URLUtils = require('dw/web/URLUtils');

            if (stickyioForceRegisteredCheckout && !req.currentCustomer.profile) { res.redirect(URLUtils.url('Checkout-Login')); }

            var checkoutView = res.getViewData();
            if (stickyio.hasSubscriptionProducts() !== false) {
                checkoutView.preventMultiShip = true;
                // for the moment, force a consumer to re-enter any saved payment information
                // eventually, we will move to accepting existing tokens and pass those along
                checkoutView.customer.payment = null;
                checkoutView.customer.customerPaymentInstruments = [];
            }
            res.setViewData(checkoutView);

            return next();
        }
    );
}

module.exports = server.exports();
