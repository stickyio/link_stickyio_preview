'use strict';

const HOLD_TYPE_CANCEL = 'user';

var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var Locale = require('dw/util/Locale');

var OrderModel = require('*/cartridge/models/order');
var stickyio = require('~/cartridge/scripts/stickyio');

var subscriptions = {};

/**
* Make sure a given subscriptionID belongs to a given sticky.io order number
* @param {string} subscriptionID - sticky.io subscription id
* @param {string} orderNumber - sticky.io order number
* @returns {boolean} - true or false
* */
function assertSubscriptionID(subscriptionID, orderNumber) {
    if (Object.keys(subscriptions).length > 0) {
        if (subscriptions[subscriptionID]) {
            var i;
            for (i = 0; i < subscriptions[subscriptionID].orderNumbers.length; i++) {
                if (subscriptions[subscriptionID].orderNumbers[i].stickyioOrderNo === orderNumber) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
* Pull the SFCC customerID from the stored sticky.io order custom_field
* @param {Object} stickyioCustomFields - array of custom_field objects
* @returns {string} - custom_field customerID
* */
function getCustomerID(stickyioCustomFields) {
    var customerID;
    if (stickyioCustomFields) {
        var i;
        for (i = 0; i < stickyioCustomFields.length; i++) {
            if (stickyioCustomFields[i].token_key === 'sfcc_customer_id') {
                customerID = stickyioCustomFields[i].values[0].value;
                break;
            }
        }
    }
    return customerID;
}

/**
* Returns a list of subscription orders for the current customer
* @param {Object} currentCustomer - object with customer properties
* @param {Object} querystring - querystring properties
* @param {string} locale - the current request's locale id
* @returns {Object} - orderModel of the current dw order object
* */
function getSubscriptions(currentCustomer, querystring, locale, billingModels) {
    // get all subscription orders for this user
    var customerID;
    var customerNo = currentCustomer.profile.customerNo;
    var customerOrders = OrderMgr.searchOrders(
        'customerNo={0} AND status!={1} AND status!={2} AND custom.stickyioOrder={3}',
        'creationDate desc',
        customerNo,
        Order.ORDER_STATUS_REPLACED,
        Order.ORDER_STATUS_FAILED,
        'TRUE'
    );

    var orders = [];

    var passedSubscriptionID = querystring.sid ? [querystring.sid] : [];

    var filterValues = [
        {
            displayValue: Resource.msg('orderhistory.sixmonths.option', 'order', null),
            optionValue: URLUtils.url('Subscriptions-Filtered', 'orderFilter', '6').abs().toString()
        },
        {
            displayValue: Resource.msg('orderhistory.twelvemonths.option', 'order', null),
            optionValue: URLUtils.url('Subscriptions-Filtered', 'orderFilter', '12').abs().toString()
        }
    ];
    var orderYear;
    var years = [];
    var customerOrder;
    var SIX_MONTHS_AGO = Date.now() - 15778476000;
    var YEAR_AGO = Date.now() - 31556952000;
    var orderModel;

    var currentLocale = Locale.getLocale(locale);

    while (customerOrders.hasNext()) {
        customerOrder = customerOrders.next();
        var config = {
            numberOfLineItems: '*'
        };

        orderYear = customerOrder.getCreationDate().getFullYear().toString();
        var orderTime = customerOrder.getCreationDate().getTime();

        if (years.indexOf(orderYear) === -1) {
            var optionURL =
                URLUtils.url('Subscriptions-Filtered', 'orderFilter', orderYear).abs().toString();
            filterValues.push({
                displayValue: orderYear,
                optionValue: optionURL
            });
            years.push(orderYear);
        }

        if (querystring.orderFilter
            && querystring.orderFilter !== '12'
            && querystring.orderFilter !== '6') {
            if (orderYear === querystring.orderFilter) {
                orderModel = new OrderModel(
                    customerOrder,
                    { config: config, countryCode: currentLocale.country }
                );
                orders.push(orderModel);
            }
        } else if (querystring.orderFilter
            && YEAR_AGO < orderTime
            && querystring.orderFilter === '12') {
            orderModel = new OrderModel(
                customerOrder,
                { config: config, countryCode: currentLocale.country }
            );
            orders.push(orderModel);
        } else if (SIX_MONTHS_AGO < orderTime) {
            orderModel = new OrderModel(
                customerOrder,
                { config: config, countryCode: currentLocale.country }
            );
            orders.push(orderModel);
        }
    }
    var sortedSubscriptions = [];
    var validSubscriptions = {};
    var i;
    var j;
    var k;
    var x;
    var y;
    var z;
    for (i = 0; i < orders.length; i++) {
        var thisOrder = OrderMgr.getOrder(orders[i].orderNumber, orders[i].orderToken);
        customerID = thisOrder.getCustomer().ID; // this gets overwritten every time, but that's ok
        var orderShipments = thisOrder.getShipments();
        orderModel = orders[i];
        for (j = 0; j < orderShipments.length; j++) {
            var thisShipment = orderShipments[j];
            var thisShipmentOrderNumbers = {
                stickyioOrderNo: thisShipment.custom.stickyioOrderNo,
                sfccOrderNo: orderModel.orderNumber,
                sfccOrderToken: orderModel.orderToken
            };
            var thisShipmentPLIs = thisShipment.productLineItems;
            for (k = 0; k < thisShipmentPLIs.length; k++) {
                var thisPLI = thisShipmentPLIs[k];
                if (thisPLI.custom.stickyioSubscriptionID && thisPLI.custom.stickyioSubscriptionID !== 'undefined' && !subscriptions[thisPLI.custom.stickyioSubscriptionID]) {
                    subscriptions[thisPLI.custom.stickyioSubscriptionID] = { orderData: {}, orderNumbers: [] };
                    subscriptions[thisPLI.custom.stickyioSubscriptionID].orderNumbers.push(thisShipmentOrderNumbers);
                    subscriptions[thisPLI.custom.stickyioSubscriptionID].orderData.shipTo = thisShipment.shippingAddress.fullName;
                    subscriptions[thisPLI.custom.stickyioSubscriptionID].orderData.name = thisPLI.productName;
                    for (x = 0; x < orderModel.items.items.length; x++) {
                        if (thisPLI.product.UUID === orderModel.items.items[x].uuid) {
                            subscriptions[thisPLI.custom.stickyioSubscriptionID].orderData.image = orderModel.items.items[x].images.small[0];
                        }
                    }
                    // extract options from the original orderModel, not the full API Order object
                    for (y = 0; y < orderModel.shipping.length; y++) {
                        var thisOrderModelShipping = orderModel.shipping[y];
                        for (z = 0; z < thisOrderModelShipping.productLineItems.items.length; z++) {
                            var thisOrderModelShippingItem = thisOrderModelShipping.productLineItems.items[z];
                            if (thisOrderModelShippingItem.id === thisPLI.productID) {
                                subscriptions[thisPLI.custom.stickyioSubscriptionID].orderData.options = thisOrderModelShippingItem.options;
                            }
                        }
                    }
                }
            }
        }
    }

    var stickyioOrderNumbers = [];

    // sort our data
    if (Object.keys(subscriptions).length > 0) {
        for (i = 0; i < Object.keys(subscriptions).length; i++) {
            subscriptions[Object.keys(subscriptions)[i]].orderNumbers.sort(function (a, b) { // sort our SFCC order numbers descending
                return b.sfccOrderNo - a.sfccOrderNo;
            });
        }
        for (i = 0; i < Object.keys(subscriptions).length; i++) { // get array of latest stickyioOrderNumbers
            stickyioOrderNumbers.push(subscriptions[Object.keys(subscriptions)[i]].orderNumbers[0].stickyioOrderNo);
        }
    }

    var stickyOrderData = stickyio.getOrders(stickyioOrderNumbers, false, false); // pull order_view data from sticky so we can obtain subscription information
    if (stickyOrderData) {
        var validSubscriptionIDs = {};
        // pull subscription_id and look at its stickyOrderNumber
        for (i = 0; i < Object.keys(stickyOrderData.orderData).length; i++) {
            var thisStickyioOrderNo = Object.keys(stickyOrderData.orderData)[i];
            var thisStickyOrderData = stickyOrderData.orderData[thisStickyioOrderNo];
            if (thisStickyOrderData.response_code === '100') {
                for (j = 0; j < thisStickyOrderData.products.length; j++) {
                    var thisProduct = thisStickyOrderData.products[j];
                    var thisProductSubscriptionID = thisProduct.subscription_id;
                    if (assertSubscriptionID(thisProductSubscriptionID, thisStickyioOrderNo) && customerID === getCustomerID(thisStickyOrderData.custom_fields)) { // make sure this stickyOrderNumber is under the subscriptionID key and belongs to the current customer. If not, toss the entire subscriptionID from subscriptions (old order in SFCC from testing sharing same order number as new order)
                        var billingModel;
                        if (billingModels) {
                            billingModel = stickyio.getBillingModelFromModels(thisProduct.billing_model.id, billingModels);
                        }
                        
                        validSubscriptionIDs[thisProductSubscriptionID] = {
                            nextRecurring: stickyio.getNextDeliveryDate(thisStickyOrderData, thisProduct, thisProduct.recurring_date, billingModel),
                            statusText: Resource.msg('label.subscriptionmanagement.active', 'stickyio', null),
                            status: 'active'
                        };
                        if (thisProduct.on_hold === '1') {
                            if (thisProduct.hold_type.toLowerCase() == HOLD_TYPE_CANCEL) {
                                validSubscriptionIDs[thisProductSubscriptionID].statusText = Resource.msg('label.subscriptionmanagement.canceled', 'stickyio', null);
                                validSubscriptionIDs[thisProductSubscriptionID].status = 'canceled';
                            } else {
                                validSubscriptionIDs[thisProductSubscriptionID].statusText = Resource.msg('label.subscriptionmanagement.on_hold', 'stickyio', null);
                                validSubscriptionIDs[thisProductSubscriptionID].status = 'hold';
                            }
                        }
                        if (thisProduct.on_hold === '0' && thisProduct.is_recurring === '0') { // logic to determine if subscription is complete
                            delete (validSubscriptionIDs[thisProductSubscriptionID].nextRecurring);
                            validSubscriptionIDs[thisProductSubscriptionID].statusText = Resource.msg('label.subscriptionmanagement.complete', 'stickyio', null);
                            validSubscriptionIDs[thisProductSubscriptionID].status = 'complete';
                        }
                    }
                }
            }
        }
        // if a subscriptionID in subscriptions isn't found in the returned data, drop it from the subscriptions object (old order in SFCC)
        if (Object.keys(subscriptions).length > 0 && Object.keys(validSubscriptionIDs).length > 0) {
            for (i = 0; i < Object.keys(validSubscriptionIDs).length; i++) {
                validSubscriptions[Object.keys(validSubscriptionIDs)[i]] = subscriptions[Object.keys(validSubscriptionIDs)[i]];
                if (validSubscriptionIDs[Object.keys(validSubscriptionIDs)[i]].nextRecurring) {
                    validSubscriptions[Object.keys(validSubscriptionIDs)[i]].orderData.nextRecurring = validSubscriptionIDs[Object.keys(validSubscriptionIDs)[i]].nextRecurring;
                }
                validSubscriptions[Object.keys(validSubscriptionIDs)[i]].orderData.statusText = validSubscriptionIDs[Object.keys(validSubscriptionIDs)[i]].statusText;
                validSubscriptions[Object.keys(validSubscriptionIDs)[i]].orderData.status = validSubscriptionIDs[Object.keys(validSubscriptionIDs)[i]].status;
            }
        }
    }

    if (Object.keys(validSubscriptions).length > 0) { // we check again to make sure there's something to sort
        Object.keys(validSubscriptions).sort(function (a, b) { // sort our validSubscriptions by SFCC order number descending
            return validSubscriptions[b].orderNumbers[0].sfccOrderNo - validSubscriptions[a].orderNumbers[0].sfccOrderNo;
        }).forEach(function (key) {
            if (passedSubscriptionID.length > 0) {
                if (passedSubscriptionID.indexOf(key) !== -1) {
                    sortedSubscriptions.push({ subscriptionID: key, orderData: validSubscriptions[key].orderData, orderNumbers: validSubscriptions[key].orderNumbers });
                }
            } else {
                sortedSubscriptions.push({ subscriptionID: key, orderData: validSubscriptions[key].orderData, orderNumbers: validSubscriptions[key].orderNumbers });
            }
        });
    }

    return {
        subscriptions: sortedSubscriptions,
        filterValues: filterValues
    };
}

module.exports = {
    getSubscriptions: getSubscriptions
};
