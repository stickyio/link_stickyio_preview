/**
 * Append any subscription details to an order for possible self-management
 */

'use strict';

var Order = module.superModule;
var server = require('server');
server.extend(Order);

var Logger = require('dw/system/Logger');
var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

if (stickyioEnabled) {
    var stickyio = require('~/cartridge/scripts/stickyio');
    var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
    var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

    server.append(
        'Details',
        consentTracking.consent,
        server.middleware.https,
        userLoggedIn.validateLoggedIn,
        function (req, res, next) {
            var orderView = res.getViewData();
            if (orderView.stickyioOrder) {
                try {
                    orderView = stickyio.updateSubscriptionDetails(orderView); // update local SFCC order with potential CSR changes in sticky.io
                } catch (e) {
                    Logger.error(e);
                }
            }
            res.setViewData(orderView);
            next();
        }
    );

    server.append(
        'Track',
        function (req, res, next) {
            if (req.currentCustomer.profile) {
                var OrderMgr = require('dw/order/OrderMgr');
                var order = OrderMgr.getOrder(req.querystring.trackOrderNumber); // not possible to update to non-deprecated getOrder() as SFRA core functionality does not provide the orderToken as a possible field
                var orderCustomerNo = req.currentCustomer.profile.customerNo;
                var currentCustomerNo = order.customer.profile.customerNo;

                var orderView = res.getViewData();
                if (orderView.order && orderView.stickyioOrder && order && orderCustomerNo === currentCustomerNo) {
                    try {
                        orderView = stickyio.updateSubscriptionDetails(orderView); // update local SFCC order with potential CSR changes in sticky.io
                    } catch (e) {
                        Logger.error(e);
                    }
                }
                res.setViewData(orderView);
            }
            return next();
        }
    );
}

module.exports = server.exports();
