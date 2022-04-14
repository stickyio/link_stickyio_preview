/**
 * prepend route with minor changes to send subscription payments through the sticky.io gateway
 * sticky.io works by mirroring your existing gateway setup, but passing all data through sticky.io
 * look at hooks.json and hookes/payment/processor/basic_credit_stickyio.js as the example for SFRA gateway passthrough
 */

'use strict';

var server = require('server');
server.extend(module.superModule);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

if (stickyioEnabled) {
    var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
    var stickyio = require('~/cartridge/scripts/stickyio');

    /**
     *  Handle Ajax payment (and billing) form submit
     */
    server.prepend(
        'SubmitPayment',
        server.middleware.https,
        csrfProtection.validateAjaxRequest,
        function (req, res, next) {
        	var BasketMgr = require('dw/order/BasketMgr');
            var PaymentManager = require('dw/order/PaymentMgr');
            var HookManager = require('dw/system/HookMgr');
            var Resource = require('dw/web/Resource');
            var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
            var currentBasket = BasketMgr.getCurrentBasket();
            var stickyioOrder = stickyio.hasSubscriptionProducts();

            if (!stickyioOrder) { return next(); }

            var viewData = {};
            var paymentForm = server.forms.getForm('billing');

            var sfccVersion60 = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioSFCCVersion60');

            // verify billing form data
            var billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
            var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

            var formFieldErrors = [];
            if (Object.keys(billingFormErrors).length) {
                formFieldErrors.push(billingFormErrors);
            } else {
                viewData.address = {
                    firstName: { value: paymentForm.addressFields.firstName.value },
                    lastName: { value: paymentForm.addressFields.lastName.value },
                    address1: { value: paymentForm.addressFields.address1.value },
                    address2: { value: paymentForm.addressFields.address2.value },
                    city: { value: paymentForm.addressFields.city.value },
                    postalCode: { value: paymentForm.addressFields.postalCode.value },
                    countryCode: { value: paymentForm.addressFields.country.value }
                };

                if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, 'states')) {
                    viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
                }
            }

            if (Object.keys(contactInfoFormErrors).length) {
                formFieldErrors.push(contactInfoFormErrors);
            } else {           
                if (!sfccVersion60) {
                    viewData.email = { value: paymentForm.contactInfoFields.email.value };
                } else {
                    viewData.email = { value: currentBasket.customerEmail};
                } 
                viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
            }

            viewData.stickyioKountSessionID = { value: paymentForm.stickyioKountSessionID.value };

            var paymentMethodIdValue = paymentForm.paymentMethod.value;

            if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
                throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
            }

            var paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();

            var paymentFormResult;
            if (HookManager.hasHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase())) {
                paymentFormResult = HookManager.callHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase(),
                    'processForm',
                    req,
                    paymentForm,
                    viewData
                );
            } else {
                paymentFormResult = HookManager.callHook('app.payment.form.processor.default_form_processor', 'processForm');
            }

            if (paymentFormResult.error && paymentFormResult.fieldErrors) {
                formFieldErrors.push(paymentFormResult.fieldErrors);
            }

            if (formFieldErrors.length || paymentFormResult.serverErrors) {
                // respond with form data and errors
                res.json({
                    form: paymentForm,
                    fieldErrors: formFieldErrors,
                    serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
                    error: true
                });

                this.emit('route:Complete', req, res);
                return true;
            }

            res.setViewData(paymentFormResult.viewData);

            // start of what used to be the BeforeComplete route

            var BasketMgr = require('dw/order/BasketMgr');
            var HookMgr = require('dw/system/HookMgr');
            var PaymentMgr = require('dw/order/PaymentMgr');
            var PaymentInstrument = require('dw/order/PaymentInstrument');
            var Transaction = require('dw/system/Transaction');
            var AccountModel = require('*/cartridge/models/account');
            var OrderModel = require('*/cartridge/models/order');
            var URLUtils = require('dw/web/URLUtils');
            var Locale = require('dw/util/Locale');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
            var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
            var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

            var currentBasket = BasketMgr.getCurrentBasket();

            var billingData = res.getViewData();

            if (!currentBasket) {
                delete billingData.paymentInformation;

                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            var validatedProducts = validationHelpers.validateProducts(currentBasket);
            if (validatedProducts.error) {
                delete billingData.paymentInformation;

                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            var billingAddress = currentBasket.billingAddress;
            var billingForm = server.forms.getForm('billing');
            var paymentMethodID = billingData.paymentMethod.value;
            if (billingData.stickyioKountSessionID) {
                billingData.paymentInformation.stickyioKountSessionID = billingData.stickyioKountSessionID;
            }

            var result;

            billingForm.creditCardFields.cardNumber.htmlValue = '';
            billingForm.creditCardFields.securityCode.htmlValue = '';

            Transaction.wrap(function () {
                if (!billingAddress) {
                    billingAddress = currentBasket.createBillingAddress();
                }

                billingAddress.setFirstName(billingData.address.firstName.value);
                billingAddress.setLastName(billingData.address.lastName.value);
                billingAddress.setAddress1(billingData.address.address1.value);
                billingAddress.setAddress2(billingData.address.address2.value);
                billingAddress.setCity(billingData.address.city.value);
                billingAddress.setPostalCode(billingData.address.postalCode.value);
                if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
                    billingAddress.setStateCode(billingData.address.stateCode.value);
                }
                billingAddress.setCountryCode(billingData.address.countryCode.value);

                if (billingData.storedPaymentUUID) {
                    billingAddress.setPhone(req.currentCustomer.profile.phone);
                    currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
                } else {
                    billingAddress.setPhone(billingData.phone.value);
                    if (!sfccVersion60) {
                        currentBasket.setCustomerEmail(billingData.email.value);
                    }           
                }
            });

            // if there is no selected payment option and balance is greater than zero
            if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
                var noPaymentMethod = {};

                noPaymentMethod[billingData.paymentMethod.htmlName] =
                    Resource.msg('error.no.selected.payment.method', 'payment', null);

                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: [noPaymentMethod],
                    serverErrors: [],
                    error: true
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            // Validate payment instrument
            var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
            var paymentCard = PaymentMgr.getPaymentCard(billingData.paymentInformation.cardType.value);

            var applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
                req.currentCustomer.raw,
                req.geolocation.countryCode,
                null
            );

            if (!applicablePaymentCards.contains(paymentCard)) {
                // Invalid Payment Instrument
                var invalidPaymentMethod = Resource.msg('error.payment.not.valid', 'checkout', null);
                delete billingData.paymentInformation;
                res.json({
                    form: billingForm,
                    fieldErrors: [],
                    serverErrors: [invalidPaymentMethod],
                    error: true
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            // check to make sure there is a payment processor
            if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
            }

            var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

            if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase() + (stickyioOrder ? '_stickyio' : ''))) {
                result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase() + (stickyioOrder ? '_stickyio' : ''),
                    'Handle',
                    currentBasket,
                    billingData.paymentInformation
                );
            } else {
                throw new Error(Resource.msg(
                    'checkout.error.notimplemented',
                    'stickyio',
                    null
                ));
            }

            // need to invalidate credit card fields
            if (result.error) {
                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: result.fieldErrors,
                    serverErrors: result.serverErrors,
                    error: true
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            if (HookMgr.hasHook('app.payment.form.processor.' + processor.ID.toLowerCase())) {
                HookMgr.callHook('app.payment.form.processor.' + processor.ID.toLowerCase(),
                    'savePaymentInformation',
                    req,
                    currentBasket,
                    billingData
                );
            } else {
                HookMgr.callHook('app.payment.form.processor.default', 'savePaymentInformation');
            }

            // Calculate the basket
            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            // Re-calculate the payments.
            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );

            if (calculatedPaymentTransaction.error) {
                res.json({
                    form: paymentForm,
                    fieldErrors: [],
                    serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                    error: true
                });
                this.emit('route:Complete', req, res);
                return true;
            }

            var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
            if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                req.session.privacyCache.set('usingMultiShipping', false);
                usingMultiShipping = false;
            }
            
            if (!sfccVersion60) {
                hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, paymentForm.contactInfoFields.email.htmlValue], function () {});
			} else {
                hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, currentBasket.customerEmail], function () {});
			}
            var currentLocale = Locale.getLocale(req.locale.id);

            var basketModel = new OrderModel(
                currentBasket,
                { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
            );

            var accountModel = new AccountModel(req.currentCustomer);
            var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                req,
                accountModel
            );

            delete billingData.paymentInformation;

            res.json({
                renderedPaymentInstruments: renderedStoredPaymentInstrument,
                customer: accountModel,
                order: basketModel,
                form: billingForm,
                error: false
            });

            this.emit('route:Complete', req, res);
            return true;
        }
    );
}

module.exports = server.exports();
