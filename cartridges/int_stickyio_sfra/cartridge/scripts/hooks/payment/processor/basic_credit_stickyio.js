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
    }

    return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createToken = createToken;
