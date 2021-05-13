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
    var Site = require('dw/system/Site');

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
                var StringUtils = require('dw/util/StringUtils');
                var Calendar = require('dw/util/Calendar');
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
                        var bufferDays = Site.current.getCustomPreferenceValue('stickyioBufferDayAmount') ? Site.current.getCustomPreferenceValue('stickyioBufferDayAmount') : 0;
                        orderView.order.bufferDays = bufferDays;

                        // loop through all productLineItems for all shipments and, if subscription, modify the recurring_date to be date + buffer
                        var stickyioSubDeliveryDate = order.custom.stickyioSubDeliveryDate;
                        var i;
                        for (i = 0; i < orderView.order.shipping.length; i++) {
                            var shippingModel = orderView.order.shipping[i];
                            var j;
                            for (j = 0; j < shippingModel.productLineItems.items.length; j++) {
                                var lineItem = shippingModel.productLineItems.items[j];
                                if (lineItem.recurring_date) {
                                    var originalRecurringDate = new Date(lineItem.recurring_date + 'T00:00:00.000Z');
                                    if (stickyioSubDeliveryDate.getTime() !== originalRecurringDate.getTime()) {
                                        var millisInADay = 1000 * 60 * 60 * 24; // 1000 milliseconds * 60 seconds * 60 minutes * 24 hours = milliseconds in a day
                                        var recurDate = originalRecurringDate.getTime() + (bufferDays * millisInADay); // add bufferDays from customer set delivery date
                                        var newDate = StringUtils.formatCalendar(new Calendar(new Date(recurDate)), 'yyyy-MM-dd'); // create new date in appropriate format yyyy-mm-dd
                                        lineItem.recurring_date = newDate;
                                    }
                                }
                            }
                        }
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
