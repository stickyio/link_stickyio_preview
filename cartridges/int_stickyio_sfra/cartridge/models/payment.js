'use strict';

var PaymentMgr = require('dw/order/PaymentMgr');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.ArrayList<dw.order.dw.order.PaymentMethod>} paymentMethods - An ArrayList of
 *      applicable payment methods that the user could use for the current basket.
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicablePaymentMethods(paymentMethods) {
    return collections.map(paymentMethods, function (method) {
        return {
            ID: method.ID,
            name: method.name,
            stickyioSubscriptionEnabled : method.custom.stickyioSubscriptionEnabled
        };
    });
}



/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {

    var paymentAmount = currentBasket.totalGrossPrice;
    var paymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount.value
    );
    
    var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');
    var stickyio = require('~/cartridge/scripts/stickyio'); 
    if (stickyioEnabled && stickyio.hasSubscriptionProducts() !== false) {
        var ArrayList = require('dw/util/ArrayList');
        var stickyPaymentMethods = new ArrayList();
        
        for (var i = 0; i < paymentMethods.length; i++) {
            if (paymentMethods[i].custom.stickyioSubscriptionEnabled) {		
                stickyPaymentMethods.push(paymentMethods[i]);
        	}
        }
        this.applicablePaymentMethods = stickyPaymentMethods ? applicablePaymentMethods(stickyPaymentMethods) : null;
    } else {
        this.applicablePaymentMethods =  paymentMethods ? applicablePaymentMethods(paymentMethods) : null;    
    } 


}
module.exports = Payment;
