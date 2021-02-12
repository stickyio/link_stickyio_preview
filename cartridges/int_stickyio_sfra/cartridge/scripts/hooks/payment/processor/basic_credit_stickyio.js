'use strict';

var collections = require('*/cartridge/scripts/util/collections');

var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var stickyio = require('~/cartridge/scripts/stickyio');

/**
 * Creates a token.
 * @param {string} cardNumber paymentInformation.cardNumber.value
 * @param {string} cardSecurityCode paymentInformation.cardSecurityCode.value
 * @param {string} cardType paymentInformation.cardType.value
 * @param {string} expirationMonth paymentInformation.expirationMonth.value
 * @param {string} expirationYear paymentInformation.expirationYear.value
 * @returns {Object} a token object containing an expiration date 15 minutes in to the future and the actual token
 */
function createToken(cardNumber, cardSecurityCode, cardType, expirationMonth, expirationYear) {
    var params = {};
    params.body = {};
    params.body.card_number = cardNumber;
    params.body.cvv = cardSecurityCode;
    params.body.expiry = expirationMonth.toString().length < 2 ? '0' + expirationMonth.toString() : expirationMonth;
    params.body.expiry += '-' + expirationYear; // mm-yyyy
    params.body.brand = cardType;
    var stickyioResponse = stickyio.stickyioAPI('stickyio.http.post.tokenize_payment').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        var token = {
            payment_token: stickyioResponse.object.result.data.token,
            expires_at: Date.now() + 900000 // token lasts 15 minutes
        };
        return token;
    }
    return false;
}

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation) {
    var currentBasket = basket;
    var cardErrors = {};
    var cardNumber = paymentInformation.cardNumber.value;
    var cardSecurityCode = paymentInformation.securityCode.value;
    var expirationMonth = paymentInformation.expirationMonth.value;
    var expirationYear = paymentInformation.expirationYear.value;
    var stickyioKountSessionID = paymentInformation.stickyioKountSessionID.value;
    var serverErrors = [];
    var creditCardStatus;
    var error = false;

    var cardType = paymentInformation.cardType.value;
    var paymentCard = PaymentMgr.getPaymentCard(cardType);

    if (!paymentInformation.creditCardToken) {
        if (paymentCard) {
            creditCardStatus = paymentCard.verify(
                expirationMonth,
                expirationYear,
                cardNumber,
                cardSecurityCode
            );
        } else {
            cardErrors[paymentInformation.cardNumber.htmlName] =
                Resource.msg('error.invalid.card.number', 'creditCard', null);

            return { fieldErrors: [cardErrors], serverErrors: serverErrors, error: true };
        }

        if (creditCardStatus.error) {
            collections.forEach(creditCardStatus.items, function (item) {
                switch (item.code) {
                    case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                        cardErrors[paymentInformation.cardNumber.htmlName] =
                            Resource.msg('error.invalid.card.number', 'creditCard', null);
                        break;

                    case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                        cardErrors[paymentInformation.expirationMonth.htmlName] =
                            Resource.msg('error.expired.credit.card', 'creditCard', null);
                        cardErrors[paymentInformation.expirationYear.htmlName] =
                            Resource.msg('error.expired.credit.card', 'creditCard', null);
                        break;

                    case PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE:
                        cardErrors[paymentInformation.securityCode.htmlName] =
                            Resource.msg('error.invalid.security.code', 'creditCard', null);
                        break;
                    default:
                        serverErrors.push(
                            Resource.msg('error.card.information.error', 'creditCard', null)
                        );
                }
            });

            return { fieldErrors: [cardErrors], serverErrors: serverErrors, error: true };
        }
    }

    Transaction.begin();
    var paymentInstruments = currentBasket.getPaymentInstruments(
        PaymentInstrument.METHOD_CREDIT_CARD
    );

    collections.forEach(paymentInstruments, function (item) {
        currentBasket.removePaymentInstrument(item);
    });

    var paymentInstrument = currentBasket.createPaymentInstrument(
        PaymentInstrument.METHOD_CREDIT_CARD, currentBasket.totalGrossPrice
    );

    paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
    paymentInstrument.setCreditCardNumber(cardNumber);
    paymentInstrument.setCreditCardType(cardType);
    paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
    paymentInstrument.setCreditCardExpirationYear(expirationYear);

    paymentInstrument.custom.stickyioKountSessionID = stickyioKountSessionID;

    if (!paymentInformation.creditCardToken) {
        var tokenResult = createToken(cardNumber, cardSecurityCode, cardType, expirationMonth, expirationYear);
        if (!tokenResult) {
            Transaction.rollback();
            error = true;
            serverErrors.push(Resource.msg('checkout.error.tokenize', 'stickyio', null));
        } else {
            paymentInstrument.setCreditCardToken(tokenResult.payment_token);
            paymentInstrument.custom.stickyioTokenExpiration = tokenResult.expires_at;
            Transaction.commit();
        }
    } else {
        paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken);
        Transaction.commit();
    }

    return { fieldErrors: cardErrors, serverErrors: serverErrors, error: error };
}

/**
 * Authorizes a payment using a credit card via sticky.io
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 * @return {Object} returns an error object
 */
function Authorize(order, paymentInstrument, paymentProcessor) {
    // call sticky.io auth_payment API
    // this method can return a variety of useful errors to the consumer, however, the method that calls it (CheckoutServices - PlaceOrder) overrides all returned errors with its own "generic" error
    // because overriding this functionality would mean replacing the entire route, we leave it to the merchant to decide whether or not to check for returned errors and display that information to
    // the consumer. Sample code might look like:
    /*
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
    if (handlePaymentResult.error) {
        res.json({
            error: true,
            errorMessage: handlePaymentResult.serverErrors.join(' - ')
        });
        return next();
    }
    */
    var serverErrors = [];
    var fieldErrors = {};
    var error = false;

    // check to make sure the payment_token is still valid
    // if this is a saved-card, though, this won't exist
    var thisPaymentInstrument = paymentInstrument;
    if (thisPaymentInstrument.custom.stickyioTokenExpiration > Date.now().time) {
        error = true;
        serverErrors.push(Resource.msg('checkout.error.tokenexpired', 'stickyio', null));
    } else {
        var tokenType = 'payment_token';
        try {
            var stickyioSampleData = stickyio.hasSubscriptionProducts(order);
            var billingAddress = order.getBillingAddress();

            var params = {};
            params.body = {};
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
            params.body[tokenType] = thisPaymentInstrument.getCreditCardToken();
            params.body.ipAddress = order.remoteHost;
            params.body.productId = stickyioSampleData.stickyioPID;
            params.body.campaignId = stickyioSampleData.stickyioCID;
            params.body.auth_amount = order.getTotalGrossPrice().value;
            params.body.cascade_enabled = false;
            params.body.save_customer = true;
            params.body.validate_only_flag = false;
            params.body.void_flag = false;

            var stickyioResponse = stickyio.stickyioAPI('stickyio.http.post.authorize_payment').call(params);
            if (!stickyioResponse.error && stickyioResponse.object.result.response_code === '100' && stickyioResponse.object.result.error_found === '0') {
                try {
                    Transaction.wrap(function () {
                        thisPaymentInstrument.custom.stickyioTempCustomerID = stickyioResponse.object.result.temp_customer_id; // the new token for final order placement
                        thisPaymentInstrument.paymentTransaction.setTransactionID(stickyioResponse.object.result.transactionID); // will return "Not Available" when testing
                        thisPaymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
                    });
                } catch (e) {
                    error = true;
                    serverErrors.push(Resource.msg('checkout.error.decline', 'stickyio', null));
                }
            } else {
                error = true;
                if (stickyioResponse.object.result.error_message) { serverErrors.push(stickyioResponse.object.result.error_message); }
                if (stickyioResponse.object.result.decline_reason) { serverErrors.push(stickyioResponse.object.result.decline_reason); }
            }
        } catch (e) {
            error = true;
            serverErrors.push(e);
        }
    }

    return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createToken = createToken;
