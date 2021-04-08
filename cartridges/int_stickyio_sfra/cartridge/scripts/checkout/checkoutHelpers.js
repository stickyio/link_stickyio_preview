'use strict';

var base = module.superModule;
var stickyio = require('~/cartridge/scripts/stickyio');

var HookMgr = require('dw/system/HookMgr');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var Order = require('dw/order/Order');
var Status = require('dw/system/Status');
var Resource = require('dw/web/Resource');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');

/**
 * handles the payment authorization for each payment instrument
 * @param {dw.order.Order} thisOrder - the order object
 * @param {string} orderNumber - The order number for the order
 * @returns {Object} an error object
 */
base.handlePayments = function (thisOrder, orderNumber) {
    var order = thisOrder;
    if (stickyio.hasSubscriptionProducts(order)) { Transaction.wrap(function () { order.custom.stickyioOrder = true; }); }
    var result = {};

    if (order.totalNetPrice !== 0.00) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }

        if (!result.error) {
            for (var i = 0; i < paymentInstruments.length; i++) {
                var paymentInstrument = paymentInstruments[i];
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                var authorizationResult;
                if (paymentProcessor === null) {
                    Transaction.begin();
                    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                    Transaction.commit();
                } else {
                    if (order.custom.stickyioOrder) {
                        if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase() + '_stickyio')) {
                            authorizationResult = HookMgr.callHook(
                            'app.payment.processor.' + paymentProcessor.ID.toLowerCase() + '_stickyio',
                            'Authorize',
                            order,
                            paymentInstrument,
                            paymentProcessor);
                        } else {
                            authorizationResult = HookMgr.callHook(
                                'app.payment.processor.default',
                                'Authorize'
                            );
                        }
                    } else if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                        'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                        'Authorize',
                        orderNumber,
                        paymentInstrument,
                        paymentProcessor);
                    } else {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.default',
                            'Authorize'
                        );
                    }

                    if (authorizationResult.error) {
                        result = authorizationResult;
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        break;
                    }
                }
            }
        }
    }

    return result;
};

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
base.placeOrderStickyio = function (order, fraudDetectionStatus) {
    // call new_order API with results from earlier AuthorizeStickyio call
    // this method can return a variety of useful errors to the consumer, however, the method that calls it (CheckoutServices - PlaceOrder) overrides all returned errors with its own "generic" error
    // because overriding this functionality would mean replacing the entire route, we leave it to the merchant to decide whether or not to check for returned errors and display that information to
    // the consumer. Sample code might look like:
    /*
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        res.json({
            error: true,
            errorMessage: placeOrderResult.serverErrors.join(' - ')
        });
        return next();
    }
    */
    var serverErrors = [];
    var error = false;
    var sendCSREmail = false;
    var failedOrderData = {};

    try {
        var stickyioSampleData = stickyio.hasSubscriptionProducts(order);
        var billingAddress = order.getBillingAddress();
        var shipment = order.getDefaultShipment(); // this will change once we support multiple shipments
        var shippingAddress = shipment.getShippingAddress(); // we don't support multiple shipping addresses... yet
        var shippingMethodID = shipment.shippingMethod.custom.stickyioShippingID;
        var paymentInstrument = order.getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD).toArray()[0];
        var plis = order.getAllProductLineItems();
        var stickyioGatewayID = Site.getCurrent().getCustomPreferenceValue('stickyioGatewayID');
        var stickyioStraightSaleProductID = Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleProductID');
        var stickyioCustomFieldSiteID = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldSiteID');
        var stickyioCustomFieldHostname = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldHostname');
        var stickyioCustomFieldShipmentID = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldShipmentID');
        var stickyioCustomFieldOrderNo = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldOrderNo');
        var stickyioCustomFieldOrderToken = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldOrderToken');
        var stickyioCustomFieldCustomerID = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldCustomerID');
        var siteIDObject = { id: stickyioCustomFieldSiteID, value: Site.getCurrent().ID };
        var hostnameObject = { id: stickyioCustomFieldHostname, value: Site.getCurrent().httpsHostName };
        var shipmentIDObject = { id: stickyioCustomFieldShipmentID, value: shipment.ID };
        var orderNoObject = { id: stickyioCustomFieldOrderNo, value: order.orderNo };
        var orderTokenObject = { id: stickyioCustomFieldOrderToken, value: order.orderToken };
        var customerIDObject = { id: stickyioCustomFieldCustomerID, value: customer.ID }; // eslint-disable-line no-undef

        var params = {};
        params.body = {};
        params.body.firstName = billingAddress.firstName;
        params.body.lastName = billingAddress.lastName;
        params.body.shippingAddress1 = shippingAddress.address1;
        params.body.shippingAddress2 = shippingAddress.address2;
        params.body.shippingCity = shippingAddress.city;
        params.body.shippingState = shippingAddress.stateCode;
        params.body.shippingZip = shippingAddress.postalCode;
        params.body.shippingCountry = shippingAddress.countryCode.value;
        params.body.billingFirstName = billingAddress.firstName;
        params.body.billingLastName = billingAddress.lastName;
        params.body.billingAddress1 = billingAddress.address1;
        params.body.billingAddress2 = billingAddress.address2;
        params.body.billingCity = billingAddress.city;
        params.body.billingState = billingAddress.stateCode;
        params.body.billingZip = billingAddress.postalCode;
        params.body.billingCountry = billingAddress.countryCode.value;
        params.body.phone = billingAddress.phone;
        params.body.email = order.getCustomerEmail();
        params.body.temp_customer_id = paymentInstrument.custom.stickyioTempCustomerID;
        params.body.forceGatewayId = stickyioGatewayID;
        params.body.preserve_force_gateway = 1;
        params.body.tranType = 'Sale';
        params.body.ipAddress = order.remoteHost;
        params.body.custom_fields = [siteIDObject, hostnameObject, shipmentIDObject, orderNoObject, orderTokenObject, customerIDObject];
        params.body.shippingId = shippingMethodID;
        params.body.campaignId = stickyioSampleData.stickyioCID;
        params.body.is_precalculated_price = true;
        params.body.dynamic_shipping_charge = shipment.shippingTotalPrice.value.toString();
        params.body.tax_rate = 0;

        if (paymentInstrument.custom.stickyioKountSessionID) {
            params.body.sessionId = paymentInstrument.custom.stickyioKountSessionID;
        }

        if (shipment.gift) {
            params.body.gift = {};
            params.body.gift.message = shipment.giftMessage;
        }

        var offers = [];
        var nonSubscriptionProduct = {};
        nonSubscriptionProduct.price = 0;
        var i;
        var j;
        var thisProduct;

        for (i = 0; i < plis.length; i++) {
            var thisOffer = {};
            var priceType = 'price';
            if (plis[i].custom.stickyioOfferID) { // subscription product
                thisOffer.offer_id = plis[i].custom.stickyioOfferID;
                thisOffer.product_id = plis[i].custom.stickyioProductID;
                thisOffer.quantity = plis[i].quantityValue;
                thisOffer.billing_model_id = plis[i].custom.stickyioBillingModelID;
                if (plis[i].custom.stickyioTermsID) {
                    thisOffer.prepaid_cycles = plis[i].custom.stickyioTermsID.split('-')[1];
                    priceType = 'prepaid_price';
                }
                thisOffer[priceType] = plis[i].adjustedNetPrice.value.toString(); // price before tax
                thisProduct = plis[i].getProduct();
                if (thisProduct && thisProduct.isVariant() && plis[i].custom.stickyioVariationID) { thisOffer.variant = { variant_id: plis[i].custom.stickyioVariationID }; }
                offers.push(thisOffer);
            } else { // this is a non-subscription product
                nonSubscriptionProduct.price += plis[i].adjustedNetPrice.value.toString();
            }
            if (plis[i].getTaxRate() > 0) { params.body.tax_rate = (plis[i].getTaxRate() * 100).toFixed(2).toString(); } // overall order tax rate, but there's a chance an item has 0% tax
        }
        if (nonSubscriptionProduct.price > 0) {
            nonSubscriptionProduct.offer_id = stickyioSampleData.stickyioOID; // use any stickyioOID
            nonSubscriptionProduct.product_id = stickyioStraightSaleProductID;
            nonSubscriptionProduct.quantity = 1;
            offers.push(nonSubscriptionProduct);
        }
        params.body.tax_amount = shipment.totalTax.value.toFixed(2);
        params.body.offers = offers;

        var thisPLIStickyID;
        var failedOrderProduct = {};

        var stickyioResponse = stickyio.stickyioAPI('stickyio.http.post.new_order').call(params);
        if (!stickyioResponse.error && stickyioResponse.object.result.response_code === '100' && stickyioResponse.object.result.error_found === '0') {
            // save our response object just in case the transaction fails in the next step
            failedOrderData.stickyioOrderNo = stickyioResponse.object.result.order_id;
            failedOrderData.products = [];
            for (i = 0; i < plis.length; i++) {
                if (plis[i].custom.stickyioOfferID) { // subscription product
                    thisPLIStickyID = plis[i].custom.stickyioProductID.toString();
                    if (plis[i].getProduct().isVariant()) {
                        thisPLIStickyID = thisPLIStickyID + '-' + plis[i].custom.stickyioVariationID;
                    }
                    for (j = 0; j < stickyioResponse.object.result.line_items.length; j++) {
                        thisProduct = stickyioResponse.object.result.line_items[j];
                        failedOrderProduct = {};
                        if (plis[i].custom.stickyioProductID === thisProduct.product_id) {
                            failedOrderProduct.id = plis[i].productID;
                            if (thisPLIStickyID.toString() === thisProduct.product_id.toString()) {
                                failedOrderProduct.subscriptionID = thisProduct.subscription_id;
                                failedOrderData.products.push(failedOrderProduct);
                                break;
                            }
                        }
                    }
                }
            }
            try {
                Transaction.wrap(function () {
                    shipment.custom.stickyioOrderNo = stickyioResponse.object.result.order_id;
                    shipment.custom.stickyioOrderResponse = JSON.stringify(stickyioResponse.object.result);
                    paymentInstrument.custom.stickyioTempCustomerID = null;
                    paymentInstrument.custom.stickyioTokenExpiration = null;
                    for (i = 0; i < plis.length; i++) {
                        if (plis[i].custom.stickyioOfferID) { // subscription product
                            thisPLIStickyID = plis[i].custom.stickyioProductID.toString();
                            if (plis[i].getProduct().isVariant()) {
                                thisPLIStickyID = thisPLIStickyID + '-' + plis[i].custom.stickyioVariationID;
                            }
                            for (j = 0; j < stickyioResponse.object.result.line_items.length; j++) {
                                thisProduct = stickyioResponse.object.result.line_items[j];
                                if (thisPLIStickyID.toString() === thisProduct.product_id.toString()) {
                                    plis[i].custom.stickyioSubscriptionID = thisProduct.subscription_id;
                                    break;
                                }
                            }
                        }
                    }
                });
            } catch (e) {
                Logger.error('sticky.io error: ' + e);
                // Allow the order to be successfully created in both SFCC and sticky.io, but notify the merchant something went wrong and they may need to fix.
                // shipment.custom.stickyioOrderNo and pli.custom.stickyioSubscriptionID are merchant-editable in Business Manager so they can manually updated.
                // These custom attributes can all be found in the SFCC order object under the Shipment and Shipment Line Items respectively.
                failedOrderData.error = e;
                sendCSREmail = true;
                error = false;
            }
        } else {
            error = true;
            Transaction.wrap(function () {
                OrderMgr.failOrder(order, true);
                paymentInstrument.custom.stickyioTempCustomerID = null;
                paymentInstrument.custom.stickyioTokenExpiration = null;
            });
            if (stickyioResponse.object.result.response_code && stickyioResponse.object.result.error_message) {
                Logger.error(stickyioResponse.object.result.response_code + ': ' + stickyioResponse.object.result.error_message);
                serverErrors.push(stickyioResponse.object.result.response_code + ': ' + stickyioResponse.object.result.error_message);
            } else {
                serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            }
            try {
                Transaction.wrap(function () {
                    shipment.custom.stickyioOrderResponse = JSON.stringify(stickyioResponse.object.result);
                });
            } catch (e) {
                error = true;
                serverErrors.push(Resource.msg('checkout.error.nosave', 'stickyio', null));
            }
        }
    } catch (e) {
        error = true;
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
    }

    if (!error) {
        try {
            Transaction.begin();
            var placeOrderStatus = OrderMgr.placeOrder(order);
            if (placeOrderStatus === Status.ERROR) {
                throw new Error();
            }

            if (fraudDetectionStatus.status === 'flag') {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
            } else {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            }

            order.setExportStatus(Order.EXPORT_STATUS_READY);
            Transaction.commit();

            if (sendCSREmail && failedOrderData.stickyioOrderNo) {
                var subject = Resource.msg('email.subject.ordererror', 'stickyio', null);
                var body = 'Customer orderNo: ' + order.orderNo + ' successfully placed, but subscription order details may be missing.\n\n';
                body += JSON.stringify(failedOrderData, null, 2);
                var Mail = require('dw/net/Mail');
                var mimeEncodedText = require('dw/value/MimeEncodedText');
                var mail = new Mail();
                mail.addTo(Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com');
                mail.setFrom(Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com');
                mail.setSubject(subject);
                mail.setContent(mimeEncodedText(body));
                mail.send();
            }
        } catch (e) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            error = true;
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        }
    }

    return { serverErrors: serverErrors, error: error };
};

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
base.placeOrder = function (order, fraudDetectionStatus) {
    var result;
    if (order.custom.stickyioOrder) {
        result = base.placeOrderStickyio(order, fraudDetectionStatus);
    } else {
        result = { error: false };

        try {
            Transaction.begin();
            var placeOrderStatus = OrderMgr.placeOrder(order);
            if (placeOrderStatus === Status.ERROR) {
                throw new Error();
            }

            if (fraudDetectionStatus.status === 'flag') {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
            } else {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            }

            order.setExportStatus(Order.EXPORT_STATUS_READY);
            Transaction.commit();
        } catch (e) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }
    }
    return result;
};

module.exports = base;
