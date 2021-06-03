'use strict';

var base = module.superModule;

/**
 * Account class that represents the current customer's profile dashboard
 * @param {Object} currentCustomer - Current customer
 * @param {Object} addressModel - The current customer's preferred address
 * @param {Object} orderModel - The current customer's order history
 * @param {boolean} subscriptions - Boolean indicating if a custom has subscription orders
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel, subscriptions) {
    base.call(this, currentCustomer, addressModel, orderModel);
    this.subscriptions = subscriptions;
}

account.getCustomerPaymentInstruments = base.getCustomerPaymentInstruments;

module.exports = account;
