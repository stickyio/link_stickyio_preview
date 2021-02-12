'use strict';

var Transaction = require('dw/system/Transaction');
var Status = require('dw/system/Status');

/**
 * Add our custom transactionID to the basket's payment instrument if it's a sticky.io order
 * @param {dw.order.Basket} basket - The current basket
 * @param {paymentInstrument} paymentInstrumentRequest - Payment Instrument Request object
 * @return {void}
 */
function updatePaymentInstrument(basket, paymentInstrumentRequest) {
    var paymentMethod;
    var paymentInstrument;
    Transaction.wrap(function () {
        paymentMethod = paymentInstrumentRequest.payment_method_id;
        paymentInstrument = basket.getPaymentInstruments(paymentMethod)[0];
        paymentInstrument.getPaymentTransaction().setTransactionID(paymentInstrument.custom.stickyioTransactionID);
        paymentInstrument.custom.stickyioTransactionID = null; // wipe this out as it's now been moved where it should be
    });
}

/**
 * Add our custom transactionID to the basket's payment instrument if it's a sticky.io order
 * @param {dw.order.Basket} basket - The current basket
 * @param {paymentInstrument} paymentInstrumentRequest - Payment Instrument Request object
 * @return {Status} returns an order status object
 */
function afterPOST(basket, paymentInstrumentRequest) {
    var shipments = basket.getShipments();
    var i;
    for (i = 0; i < shipments.length; i++) {
        if (shipments[i].custom.stickyioOrderNo) {
            try {
                updatePaymentInstrument(basket, paymentInstrumentRequest);
            } catch (e) {
                return new Status(Status.ERROR);
            }
        }
    }
    return new Status(Status.OK);
}

exports.afterPOST = afterPOST;
