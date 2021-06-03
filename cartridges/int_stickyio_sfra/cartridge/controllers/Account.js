'use strict';

var Account = module.superModule;
var server = require('server');
server.extend(Account);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

/**
 * Creates an account model for the current customer - inelegant override to inject subscrption availability into the order view
 * "Inelegant" because an interator can only be looped through once, so we keep the existing orderModel-supplying iterator and
 * create a second only to loop through to discover if the customer has any subscriptions, then we throw it away.
 * @param {Object} req - local instance of request object
 * @returns {Object} a plain object of the current customer's account
 */
function getModel(req) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Order = require('dw/order/Order');
    var AccountModel = require('~/cartridge/models/account');
    var AddressModel = require('*/cartridge/models/address');
    var OrderModel = require('*/cartridge/models/order');
    var Locale = require('dw/util/Locale');

    var orderModel;
    var preferredAddressModel;
    var subscriptions = false;

    if (!req.currentCustomer.profile) {
        return null;
    }

    var customerNo = req.currentCustomer.profile.customerNo;
    var customerOrders = OrderMgr.searchOrders(
        'customerNo={0} AND status!={1}',
        'creationDate desc',
        customerNo,
        Order.ORDER_STATUS_REPLACED
    );

    if (stickyioEnabled) {
        var allOrders = OrderMgr.searchOrders(
            'customerNo={0} AND status!={1} AND status!={2} AND custom.stickyioOrder={3}',
            'creationDate desc',
            customerNo,
            Order.ORDER_STATUS_REPLACED,
            Order.ORDER_STATUS_FAILED,
            'TRUE'
        );

        if (allOrders.count > 0) {
            subscriptions = true;
        }
        allOrders.close();
    }

    var order = customerOrders.first();

    if (order) {
        var currentLocale = Locale.getLocale(req.locale.id);

        var config = {
            numberOfLineItems: 'single'
        };

        orderModel = new OrderModel(order, { config: config, countryCode: currentLocale.country });
    } else {
        orderModel = null;
    }

    if (req.currentCustomer.addressBook.preferredAddress) {
        preferredAddressModel = new AddressModel(req.currentCustomer.addressBook.preferredAddress);
    } else {
        preferredAddressModel = null;
    }

    return new AccountModel(req.currentCustomer, preferredAddressModel, orderModel, subscriptions);
}

if (stickyioEnabled) {
    server.append(
        'Show',
        function (req, res, next) {
            var accountData = res.getViewData();
            accountData.account = getModel(req);
            res.setViewData(accountData);

            return next();
        }
    );
}

module.exports = server.exports();
