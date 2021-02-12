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
    var OrderMgr = require('dw/order/OrderMgr');

    server.append(
        'Confirm',
        function (req, res, next) {
            var order = OrderMgr.getOrder(req.querystring.ID);
            var token = req.querystring.token ? req.querystring.token : null;

            if (!order
                || !token
                || token !== order.orderToken
                || order.customer.ID !== req.currentCustomer.raw.ID
            ) {
                return next();
            }

            var orderView = res.getViewData();
            if (order.custom.stickyioOrder === true) {
                orderView.stickyioOrder = true;
                if (req.currentCustomer.profile) {
                    try {
                        orderView = stickyio.updateOrderView(orderView, order);
                    } catch (e) {
                        Logger.error(e);
                    }
                }
            }
            res.setViewData(orderView);

            return next();
        }
    );

    server.append(
        'Details',
        function (req, res, next) {
            if (req.currentCustomer.profile) {
                var order = OrderMgr.getOrder(req.querystring.orderID);
                var OrderModel = require('*/cartridge/models/order');
                var Locale = require('dw/util/Locale');
                var orderCustomerNo = req.currentCustomer.profile.customerNo;
                var currentCustomerNo = order.customer.profile.customerNo;
                var orderView = res.getViewData();
                if (order && orderCustomerNo === currentCustomerNo && order.custom.stickyioOrder) {
                    try {
                        orderView = stickyio.updateOrderView(orderView, order);
                        // we have to update the order model again because details from sticky.io may have changed the original order
                        var config = { numberOfLineItems: '*' };
                        var currentLocale = Locale.getLocale(req.locale.id);
                        var updatedOrder = OrderMgr.getOrder(req.querystring.orderID);
                        var orderModel = new OrderModel(
                            updatedOrder,
                            { config: config, countryCode: currentLocale.country, containerView: 'order' }
                        );
                        orderView.order = stickyio.appendPLIs(orderModel, orderView.stickyioOrderData.data);
                        orderView.order.orderToken = order.orderToken;
                    } catch (e) {
                        Logger.error(e);
                    }
                }
                res.setViewData(orderView);
            }

            return next();
        }
    );

    server.append(
        'Track',
        function (req, res, next) {
            if (req.currentCustomer.profile) {
                var order = OrderMgr.getOrder(req.querystring.trackOrderNumber);
                var orderCustomerNo = req.currentCustomer.profile.customerNo;
                var currentCustomerNo = order.customer.profile.customerNo;

                var orderView = res.getViewData();
                if (orderView.order && order && orderCustomerNo === currentCustomerNo && order.custom.stickyioOrder) {
                    try {
                        orderView = stickyio.updateOrderView(orderView, order);
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
