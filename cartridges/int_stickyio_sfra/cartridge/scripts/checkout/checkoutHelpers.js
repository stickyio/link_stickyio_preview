'use strict';

var server = require('server');

var collections = require('*/cartridge/scripts/util/collections');

var BasketMgr = require('dw/order/BasketMgr');
var HookMgr = require('dw/system/HookMgr');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var Order = require('dw/order/Order');
var Status = require('dw/system/Status');
var Resource = require('dw/web/Resource');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');

var AddressModel = require('*/cartridge/models/address');
var formErrors = require('*/cartridge/scripts/formErrors');

var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');
var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');

var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

var stickyio = require('~/cartridge/scripts/stickyio');

// static functions needed for Checkout Controller logic

/**
 * Prepares the Shipping form
 * @returns {Object} processed Shipping form object
 */
function prepareShippingForm() {
    var shippingForm = server.forms.getForm('shipping');

    shippingForm.clear();

    return shippingForm;
}

/**
 * Prepares the Billing form
 * @returns {Object} processed Billing form object
 */
function prepareBillingForm() {
    var billingForm = server.forms.getForm('billing');
    billingForm.clear();

    return billingForm;
}

/**
 * Validate billing form
 * @param {Object} form - the form object with pre-validated form fields
 * @returns {Object} the names of the invalid form fields
 */
function validateFields(form) {
    return formErrors.getFormErrors(form);
}

/**
 * Validate shipping form fields
 * @param {Object} form - the form object with pre-validated form fields
 * @param {Array} fields - the fields to validate
 * @returns {Object} the names of the invalid form fields
 */
function validateShippingForm(form) {
    return validateFields(form);
}

/**
 * Checks to see if the shipping address is initialized
 * @param {dw.order.Shipment} [shipment] - Script API Shipment object
 * @returns {boolean} returns true if defaulShipment.shippingAddress is not null
 */
function isShippingAddressInitialized(shipment) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var initialized = false;

    if (currentBasket) {
        if (shipment) {
            initialized = !!shipment.shippingAddress;
        } else {
            initialized = !!currentBasket.defaultShipment.shippingAddress;
        }
    }

    return initialized;
}

/**
 * Copies a CustomerAddress to a Shipment as its Shipping Address
 * @param {dw.customer.CustomerAddress} address - The customer address
 * @param {dw.order.Shipment} [shipmentOrNull] - The target shipment
 */
function copyCustomerAddressToShipment(address, shipmentOrNull) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var shipment = shipmentOrNull || currentBasket.defaultShipment;
    var shippingAddress = shipment.shippingAddress;

    Transaction.wrap(function () {
        if (shippingAddress === null) {
            shippingAddress = shipment.createShippingAddress();
        }

        shippingAddress.setFirstName(address.firstName);
        shippingAddress.setLastName(address.lastName);
        shippingAddress.setAddress1(address.address1);
        shippingAddress.setAddress2(address.address2);
        shippingAddress.setCity(address.city);
        shippingAddress.setPostalCode(address.postalCode);
        shippingAddress.setStateCode(address.stateCode);
        var countryCode = address.countryCode;
        shippingAddress.setCountryCode(countryCode.value);
        shippingAddress.setPhone(address.phone);
    });
}

/**
 * Copies a CustomerAddress to a Basket as its Billing Address
 * @param {dw.customer.CustomerAddress} address - The customer address
 */
function copyCustomerAddressToBilling(address) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var billingAddress = currentBasket.billingAddress;

    Transaction.wrap(function () {
        if (!billingAddress) {
            billingAddress = currentBasket.createBillingAddress();
        }

        billingAddress.setFirstName(address.firstName);
        billingAddress.setLastName(address.lastName);
        billingAddress.setAddress1(address.address1);
        billingAddress.setAddress2(address.address2);
        billingAddress.setCity(address.city);
        billingAddress.setPostalCode(address.postalCode);
        billingAddress.setStateCode(address.stateCode);
        var countryCode = address.countryCode;
        billingAddress.setCountryCode(countryCode.value);
        if (!billingAddress.phone) {
            billingAddress.setPhone(address.phone);
        }
    });
}

/**
 * Copies information from the shipping form to the associated shipping address
 * @param {Object} shippingData - the shipping data
 * @param {dw.order.Shipment} [shipmentOrNull] - the target Shipment
 */
function copyShippingAddressToShipment(shippingData, shipmentOrNull) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var shipment = shipmentOrNull || currentBasket.defaultShipment;

    var shippingAddress = shipment.shippingAddress;

    Transaction.wrap(function () {
        if (shippingAddress === null) {
            shippingAddress = shipment.createShippingAddress();
        }

        shippingAddress.setFirstName(shippingData.address.firstName);
        shippingAddress.setLastName(shippingData.address.lastName);
        shippingAddress.setAddress1(shippingData.address.address1);
        shippingAddress.setAddress2(shippingData.address.address2);
        shippingAddress.setCity(shippingData.address.city);
        shippingAddress.setPostalCode(shippingData.address.postalCode);
        shippingAddress.setStateCode(shippingData.address.stateCode);
        var countryCode = shippingData.address.countryCode.value ? shippingData.address.countryCode.value : shippingData.address.countryCode;
        shippingAddress.setCountryCode(countryCode);
        shippingAddress.setPhone(shippingData.address.phone);

        ShippingHelper.selectShippingMethod(shipment, shippingData.shippingMethod);
    });
}

/**
 * Copies a raw address object to the baasket billing address
 * @param {Object} address - an address-similar Object (firstName, ...)
 * @param {Object} currentBasket - the current shopping basket
 */
function copyBillingAddressToBasket(address, currentBasket) {
    var billingAddress = currentBasket.billingAddress;

    Transaction.wrap(function () {
        if (!billingAddress) {
            billingAddress = currentBasket.createBillingAddress();
        }

        billingAddress.setFirstName(address.firstName);
        billingAddress.setLastName(address.lastName);
        billingAddress.setAddress1(address.address1);
        billingAddress.setAddress2(address.address2);
        billingAddress.setCity(address.city);
        billingAddress.setPostalCode(address.postalCode);
        billingAddress.setStateCode(address.stateCode);
        billingAddress.setCountryCode(address.countryCode.value);
        if (!billingAddress.phone) {
            billingAddress.setPhone(address.phone);
        }
    });
}

/**
 * Returns the first non-default shipment with more than one product line item
 * @param {dw.order.Basket} currentBasket - The current Basket
 * @returns {dw.order.Shipment} - the shipment
 */
function getFirstNonDefaultShipmentWithProductLineItems(currentBasket) {
    var shipment;
    var match;

    for (var i = 0, ii = currentBasket.shipments.length; i < ii; i++) {
        shipment = currentBasket.shipments[i];
        if (!shipment.default && shipment.productLineItems.length > 0) {
            match = shipment;
            break;
        }
    }

    return match;
}

/**
 * Loop through all shipments and make sure all not null
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket
 * @returns {boolean} - allValid
 */
function ensureValidShipments(lineItemContainer) {
    var shipments = lineItemContainer.shipments;
    var allValid = collections.every(shipments, function (shipment) {
        if (shipment) {
            var address = shipment.shippingAddress;
            return address && address.address1;
        }
        return false;
    });
    return allValid;
}


/**
 * Ensures that no shipment exists with 0 product line items
 * @param {Object} req - the request object needed to access session.privacyCache
 */
function ensureNoEmptyShipments(req) {
    Transaction.wrap(function () {
        var currentBasket = BasketMgr.getCurrentBasket();

        var iter = currentBasket.shipments.iterator();
        var shipment;
        var shipmentsToDelete = [];

        while (iter.hasNext()) {
            shipment = iter.next();
            if (shipment.productLineItems.length < 1 && shipmentsToDelete.indexOf(shipment) < 0) {
                if (shipment.default) {
                    // Cant delete the defaultShipment
                    // Copy all line items from 2nd to first
                    var altShipment = getFirstNonDefaultShipmentWithProductLineItems(currentBasket);
                    if (!altShipment) return;

                    // Move the valid marker with the shipment
                    var altValid = req.session.privacyCache.get(altShipment.UUID);
                    req.session.privacyCache.set(currentBasket.defaultShipment.UUID, altValid);

                    collections.forEach(altShipment.productLineItems,
                        function (lineItem) {
                            lineItem.setShipment(currentBasket.defaultShipment);
                        });

                    if (altShipment.shippingAddress) {
                        // Copy from other address
                        var addressModel = new AddressModel(altShipment.shippingAddress);
                        copyShippingAddressToShipment(addressModel, currentBasket.defaultShipment);
                    } else {
                        // Or clear it out
                        currentBasket.defaultShipment.createShippingAddress();
                    }

                    if (altShipment.custom && altShipment.custom.fromStoreId && altShipment.custom.shipmentType) {
                        currentBasket.defaultShipment.custom.fromStoreId = altShipment.custom.fromStoreId;
                        currentBasket.defaultShipment.custom.shipmentType = altShipment.custom.shipmentType;
                    }

                    currentBasket.defaultShipment.setShippingMethod(altShipment.shippingMethod);
                    // then delete 2nd one
                    shipmentsToDelete.push(altShipment);
                } else {
                    shipmentsToDelete.push(shipment);
                }
            }
        }

        for (var j = 0, jj = shipmentsToDelete.length; j < jj; j++) {
            currentBasket.removeShipment(shipmentsToDelete[j]);
        }
    });
}

/**
 * Recalculates the currentBasket
 * @param {dw.order.Basket} currentBasket - the target Basket
 */
function recalculateBasket(currentBasket) {
    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });
}


/**
 * Finds and returns a ProductLineItem by UUID
 * @param {dw.order.Basket} currentBasket - the basket to search
 * @param {string} pliUUID - the target UUID
 * @returns {dw.order.ProductLineItem} the associated ProductLineItem
 */
function getProductLineItem(currentBasket, pliUUID) {
    var productLineItem;
    var pli;
    for (var i = 0, ii = currentBasket.productLineItems.length; i < ii; i++) {
        pli = currentBasket.productLineItems[i];
        if (pli.UUID === pliUUID) {
            productLineItem = pli;
            break;
        }
    }
    return productLineItem;
}

/**
 * Validate billing form fields
 * @param {Object} form - the form object with pre-validated form fields
 * @param {Array} fields - the fields to validate
 * @returns {Object} the names of the invalid form fields
 */
function validateBillingForm(form) {
    return validateFields(form);
}

/**
 * Validate credit card form fields
 * @param {Object} form - the form object with pre-validated form fields
 * @returns {Object} the names of the invalid form fields
 */
function validateCreditCard(form) {
    var result = {};
    var currentBasket = BasketMgr.getCurrentBasket();

    if (!form.paymentMethod.value) {
        if (currentBasket.totalGrossPrice.value > 0) {
            result[form.paymentMethod.htmlName] =
                Resource.msg('error.no.selected.payment.method', 'creditCard', null);
        }

        return result;
    }

    return validateFields(form);
}

/**
 * Sets the payment transaction amount
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {Object} an error object
 */
function calculatePaymentTransaction(currentBasket) {
    var result = { error: false };

    try {
        // TODO: This function will need to account for gift certificates at a later date
        Transaction.wrap(function () {
            var paymentInstruments = currentBasket.paymentInstruments;

            if (!paymentInstruments.length) {
                return;
            }

            // Assuming that there is only one payment instrument used for the total order amount.
            // TODO: Will have to rewrite this logic once we start supporting multiple payment instruments for same order
            var orderTotal = currentBasket.totalGrossPrice;
            var paymentInstrument = paymentInstruments[0];

            paymentInstrument.paymentTransaction.setAmount(orderTotal);
        });
    } catch (e) {
        result.error = true;
    }

    return result;
}


/**
 * Validates payment
 * @param {Object} req - The local instance of the request object
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {Object} an object that has error information
 */
function validatePayment(req, currentBasket) {
    var applicablePaymentCards;
    var applicablePaymentMethods;
    var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
    var paymentAmount = currentBasket.totalGrossPrice.value;
    var countryCode = req.geolocation.countryCode;
    var currentCustomer = req.currentCustomer.raw;
    var paymentInstruments = currentBasket.paymentInstruments;
    var result = {};

    applicablePaymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount
    );
    applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
        currentCustomer,
        countryCode,
        paymentAmount
    );

    var invalid = true;

    for (var i = 0; i < paymentInstruments.length; i++) {
        var paymentInstrument = paymentInstruments[i];

        if (PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals(paymentInstrument.paymentMethod)) {
            invalid = false;
        }

        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());

        if (paymentMethod && applicablePaymentMethods.contains(paymentMethod)) {
            if (PaymentInstrument.METHOD_CREDIT_CARD.equals(paymentInstrument.paymentMethod)) {
                var card = PaymentMgr.getPaymentCard(paymentInstrument.creditCardType);

                // Checks whether payment card is still applicable.
                if (card && applicablePaymentCards.contains(card)) {
                    invalid = false;
                }
            } else {
                invalid = false;
            }
        }

        if (invalid) {
            break; // there is an invalid payment instrument
        }
    }

    result.error = invalid;
    return result;
}

/**
 * Attempts to create an order from the current basket
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {dw.order.Order} The order object created from the current basket
 */
function createOrder(currentBasket) {
    var order;

    try {
        order = Transaction.wrap(function () {
            return OrderMgr.createOrder(currentBasket);
        });
    } catch (error) {
        return null;
    }
    return order;
}

/**
 * handles the payment authorization for each payment instrument
 * @param {dw.order.Order} thisOrder - the order object
 * @param {string} orderNumber - The order number for the order
 * @returns {Object} an error object
 */
function handlePayments(thisOrder, orderNumber) {
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
}

/**
 * Sends a confirmation to the current user
 * @param {dw.order.Order} order - The current user's order
 * @param {string} locale - the current request's locale id
 * @returns {void}
 */
function sendConfirmationEmail(order, locale) {
    var OrderModel = require('*/cartridge/models/order');
    var emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');
    var Locale = require('dw/util/Locale');

    var currentLocale = Locale.getLocale(locale);

    var orderModel = new OrderModel(order, { countryCode: currentLocale.country, containerView: 'order' });

    var orderObject = { order: orderModel };

    var emailObj = {
        to: order.customerEmail,
        subject: Resource.msg('subject.order.confirmation.email', 'order', null),
        from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com',
        type: emailHelpers.emailTypes.orderConfirmation
    };

    emailHelpers.sendEmail(emailObj, 'checkout/confirmation/confirmationEmail', orderObject);
}

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
function placeOrderStickyio(order, fraudDetectionStatus) {
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
        var stickyioCustomFieldShipmentID = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldShipmentID');
        var stickyioCustomFieldOrderNo = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldOrderNo');
        var stickyioCustomFieldCustomerID = Site.getCurrent().getCustomPreferenceValue('stickyioCustomFieldCustomerID');
        var siteIDObject = { id: stickyioCustomFieldSiteID, value: Site.getCurrent().ID };
        var shipmentIDObject = { id: stickyioCustomFieldShipmentID, value: shipment.ID };
        var orderNoObject = { id: stickyioCustomFieldOrderNo, value: order.orderNo };
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
        params.body.forceGatewayId = stickyioGatewayID?stickyioGatewayID:1;
        params.body.preserve_force_gateway = 1;
        params.body.sessionId = paymentInstrument.custom.stickyioKountSessionID;
        params.body.tranType = 'Sale';
        params.body.ipAddress = order.remoteHost;
        params.body.custom_fields = [siteIDObject, shipmentIDObject, orderNoObject, customerIDObject];
        params.body.shippingId = shippingMethodID;
        params.body.campaignId = stickyioSampleData.stickyioCID;
        params.body.is_precalculated_price = true;
        params.body.dynamic_shipping_charge = shipment.shippingTotalPrice.value;
        params.body.tax_rate = 0;

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
            if (plis[i].custom.stickyioOfferID) { // subscription product
                thisOffer.offer_id = plis[i].custom.stickyioOfferID;
                thisOffer.product_id = plis[i].custom.stickyioProductID;
                thisOffer.quantity = plis[i].quantityValue;
                thisOffer.price = plis[i].adjustedNetPrice.value; // price before tax
                // thisOffer.tax_rate = (plis[i].getTaxRate().value * 100).toFixed(2);
                // thisOffer.tax_amount = plis[i].adjustedTax.value;
                thisOffer.billing_model_id = plis[i].custom.stickyioBillingModelID;
                thisProduct = plis[i].getProduct();
                if (thisProduct && thisProduct.isVariant() && plis[i].custom.stickyioVariationID) { thisOffer.variant = { variant_id: plis[i].custom.stickyioVariationID }; }
                offers.push(thisOffer);
            } else { // this is a non-subscription product
                nonSubscriptionProduct.price += plis[i].adjustedNetPrice.value;
            }
            if (plis[i].getTaxRate() > 0) { params.body.tax_rate = (plis[i].getTaxRate() * 100).toFixed(2); } // overall order tax rate, but there's a chance an item has 0% tax
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
                dw.system.Logger.error('sticky.io error: ' + e);
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
            if(stickyioResponse.object.result.response_code && stickyioResponse.object.result.error_message) {
                dw.system.Logger.error(stickyioResponse.object.result.response_code + ': ' + stickyioResponse.object.result.error_message);
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
        serverErrors.push(e); // the actual error message
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
}

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
function placeOrder(order, fraudDetectionStatus) {
    var result;
    if (order.custom.stickyioOrder) {
        result = placeOrderStickyio(order, fraudDetectionStatus);
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
}

/**
 * saves payment instruemnt to customers wallet
 * @param {Object} billingData - billing information entered by the user
 * @param {dw.order.Basket} currentBasket - The current basket
 * @param {dw.customer.Customer} customer - The current customer
 * @returns {dw.customer.CustomerPaymentInstrument} newly stored payment Instrument
 */
function savePaymentInstrumentToWallet(billingData, currentBasket, customer) {
    var wallet = customer.getProfile().getWallet();

    return Transaction.wrap(function () {
        var storedPaymentInstrument = wallet.createPaymentInstrument(PaymentInstrument.METHOD_CREDIT_CARD);

        storedPaymentInstrument.setCreditCardHolder(
            currentBasket.billingAddress.fullName
        );
        storedPaymentInstrument.setCreditCardNumber(
            billingData.paymentInformation.cardNumber.value
        );
        storedPaymentInstrument.setCreditCardType(
            billingData.paymentInformation.cardType.value
        );
        storedPaymentInstrument.setCreditCardExpirationMonth(
            billingData.paymentInformation.expirationMonth.value
        );
        storedPaymentInstrument.setCreditCardExpirationYear(
            billingData.paymentInformation.expirationYear.value
        );

        var processor = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD).getPaymentProcessor();
        var token = HookMgr.callHook(
            'app.payment.processor.' + processor.ID.toLowerCase(),
            'createMockToken'
        );

        storedPaymentInstrument.setCreditCardToken(token);

        return storedPaymentInstrument;
    });
}

/**
 * renders the user's stored payment Instruments
 * @param {Object} req - The request object
 * @param {Object} accountModel - The account model for the current customer
 * @returns {string|null} newly stored payment Instrument
 */
function getRenderedPaymentInstruments(req, accountModel) {
    var result;

    if (req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
        && req.currentCustomer.raw.profile.wallet.paymentInstruments.getLength()
    ) {
        var context;
        var template = 'checkout/billing/storedPaymentInstruments';

        context = { customer: accountModel };
        result = renderTemplateHelper.getRenderedHtml(
            context,
            template
        );
    }

    return result || null;
}

/**
 * sets the gift message on a shipment
 * @param {dw.order.Shipment} shipment - Any shipment for the current basket
 * @param {boolean} isGift - is the shipment a gift
 * @param {string} giftMessage - The gift message the user wants to attach to the shipment
 * @returns {Object} object containing error information
 */
function setGift(shipment, isGift, giftMessage) {
    var result = { error: false, errorMessage: null };

    try {
        Transaction.wrap(function () {
            shipment.setGift(isGift);

            if (isGift && giftMessage) {
                shipment.setGiftMessage(giftMessage);
            } else {
                shipment.setGiftMessage(null);
            }
        });
    } catch (e) {
        result.error = true;
        result.errorMessage = Resource.msg('error.message.could.not.be.attached', 'checkout', null);
    }

    return result;
}

module.exports = {
    getFirstNonDefaultShipmentWithProductLineItems: getFirstNonDefaultShipmentWithProductLineItems,
    ensureNoEmptyShipments: ensureNoEmptyShipments,
    getProductLineItem: getProductLineItem,
    isShippingAddressInitialized: isShippingAddressInitialized,
    prepareShippingForm: prepareShippingForm,
    prepareBillingForm: prepareBillingForm,
    copyCustomerAddressToShipment: copyCustomerAddressToShipment,
    copyCustomerAddressToBilling: copyCustomerAddressToBilling,
    copyShippingAddressToShipment: copyShippingAddressToShipment,
    copyBillingAddressToBasket: copyBillingAddressToBasket,
    validateFields: validateFields,
    validateShippingForm: validateShippingForm,
    validateBillingForm: validateBillingForm,
    validatePayment: validatePayment,
    validateCreditCard: validateCreditCard,
    calculatePaymentTransaction: calculatePaymentTransaction,
    recalculateBasket: recalculateBasket,
    handlePayments: handlePayments,
    createOrder: createOrder,
    placeOrder: placeOrder,
    placeOrderStickyio: placeOrderStickyio,
    savePaymentInstrumentToWallet: savePaymentInstrumentToWallet,
    getRenderedPaymentInstruments: getRenderedPaymentInstruments,
    sendConfirmationEmail: sendConfirmationEmail,
    ensureValidShipments: ensureValidShipments,
    setGift: setGift
};
