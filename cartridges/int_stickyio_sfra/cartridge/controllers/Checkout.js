'use strict';

var Checkout = module.superModule;
var server = require('server');
server.extend(Checkout);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');
var stickyioForceRegisteredCheckout = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioForceRegisteredCheckout');
var sfccVersion = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioMajorSFRAVersion');

if (stickyioEnabled) {
    var stickyio = require('~/cartridge/scripts/stickyio');
    if (sfccVersion < 6) {
        server.append(
            'Login',
            function (req, res, next) {
                var checkoutView = res.getViewData();
                checkoutView.allowGuestCheckout = true;
                if (stickyio.hasSubscriptionProducts() !== false) {
                    checkoutView.stickyioForceRegisteredCheckout = stickyioForceRegisteredCheckout;
                    checkoutView.stickyioOrder = true;
                }
                res.setViewData(checkoutView);
                return next();
            }
        );
    }

    server.append(
        'Begin',
        function (req, res, next) {
            var URLUtils = require('dw/web/URLUtils');

            if (sfccVersion < 6 && stickyioForceRegisteredCheckout && !req.currentCustomer.profile) {
                res.redirect(URLUtils.url('Checkout-Login'));
            }

            var checkoutView = res.getViewData();
            checkoutView.sfccVersion = sfccVersion;
            if (stickyio.hasSubscriptionProducts() !== false) {
                if (stickyioForceRegisteredCheckout) {
                    checkoutView.allowGuestCheckout = false;
                } else {
                    checkoutView.allowGuestCheckout = true;
                }
                checkoutView.preventMultiShip = true;
                // for the moment, force a consumer to re-enter any saved payment information
                // eventually, we will move to accepting existing tokens and pass those along
                checkoutView.customer.payment = null;
                checkoutView.customer.customerPaymentInstruments = [];
                checkoutView.stickyioForceRegisteredCheckout = stickyioForceRegisteredCheckout;
                checkoutView.stickyioOrder = true;
            } else {
                checkoutView.allowGuestCheckout = true;
            }
            res.setViewData(checkoutView);
            return next();
        }
    );
}
else {
    server.append(
        'Begin',
        function (req, res, next) {
            var checkoutView = res.getViewData();
            checkoutView.allowGuestCheckout = true;
            checkoutView.sfccVersion = sfccVersion;
            res.setViewData(checkoutView);
            return next();
        }
    );
}

module.exports = server.exports();
