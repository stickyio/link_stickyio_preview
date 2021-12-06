'use strict';

var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var Status = require('dw/system/Status');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

/**
 * Set channel type to subscriptions if this OCAPI basket is from sticky.io
 * @param {dw.order.Basket} basket - The current basket
 * @return {Status} returns an order status object
 */
function beforePOST(basket) {
    if (stickyioEnabled) {
        var shipments = basket.getShipments();
        var i;
        for (i = 0; i < shipments.length; i++) {
            if (shipments[i].custom.stickyioOrderNo) {
                Transaction.wrap(function () { basket.setChannelType(9); }); // CHANNEL_TYPE_SUBSCRIPTIONS
                break;
            }
        }
    }
    return new Status(Status.OK);
}

/**
 * Changes order status to NEW if this OCAPI order is from sticky.io
 * @param {dw.order.Order} order - The current order
 * @return {Status} returns an order status object
 */
function afterPOST(order) {
    if (stickyioEnabled) {
        var stickyio = require('~/cartridge/scripts/stickyio');
        var thisOrder = order;
        var shipments = thisOrder.getShipments();
        var i;
        for (i = 0; i < shipments.length; i++) {
            if (shipments[i].custom.stickyioOrderNo) {
                try {
                    Transaction.begin();
                    var placeOrderStatus = OrderMgr.placeOrder(thisOrder);
                    if (placeOrderStatus === Status.ERROR) { throw new Error(); }
                    thisOrder.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                    thisOrder.setExportStatus(Order.EXPORT_STATUS_READY);
                    thisOrder.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    thisOrder.custom.stickyioOrder = true;
                    Transaction.commit();
                    /*
                    // if you have custom fields in sticky.io that need to be updated with data, this is the place to do it for any re-bills
                    var customFields = [];
                    var customField1 = { token: 'customField1Name', value: customField1Value };
                    customFields.push(customField1);
                    stickyio.updateStickyioCustomField(shipments[i].custom.stickyioOrderNo, customFields);
                    */
                    COHelpers.sendConfirmationEmail(thisOrder, thisOrder.getCustomerLocaleID()); // change this to your Subscription Re-Bill Confirmation helper function/template
                } catch (e) {
                    Transaction.wrap(function () { OrderMgr.failOrder(thisOrder, true); });
                    stickyio.voidStickyioOrder(shipments[i].custom.stickyioOrderNo);
                    return new Status(Status.ERROR);
                }
            }
        }
    }
    return new Status(Status.OK);
}

exports.beforePOST = beforePOST;
exports.afterPOST = afterPOST;
