'use strict';

const ACTION_CANCEL = 'cancel';
const ACTION_TERMINATE_NEXT = 'terminate_next';

var server = require('server');
var Site = require('dw/system/Site');
var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');
let ProductMgr = require('dw/catalog/ProductMgr');
let ProductFactory = require('*/cartridge/scripts/factories/product');
let renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

if (stickyioEnabled) {
    var stickyio = require('~/cartridge/scripts/stickyio');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
    var URLUtils = require('dw/web/URLUtils');
    var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
    var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

    server.get(
        'Filtered',
        server.middleware.https,
        consentTracking.consent,
        userLoggedIn.validateLoggedInAjax,
        function (req, res, next) {
            var SubscriptionHelpers = require('~/cartridge/scripts/subscription/subscriptionHelpers');

            var data = res.getViewData();
            if (data && !data.loggedin) {
                res.json();
                return next();
            }
            var billingModels = stickyio.getBillingModelsFromStickyio(1, {});
            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id,
                billingModels
            );
            var subscriptions = ordersResult.subscriptions;
            var filterValues = ordersResult.filterValues;

            res.render('account/subscription/subscriptionList', {
                subscriptions: subscriptions,
                filterValues: filterValues,
                orderFilter: req.querystring.orderFilter,
                accountlanding: false
            });
            return next();
        }
    );

    server.get(
        'List',
        consentTracking.consent,
        server.middleware.https,
        userLoggedIn.validateLoggedIn,
        function (req, res, next) {
            var SubscriptionHelpers = require('~/cartridge/scripts/subscription/subscriptionHelpers');
            var billingModels = stickyio.getBillingModelsFromStickyio(1, {});
            
            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id,
                billingModels
            );
            var subscriptions = ordersResult.subscriptions;
            var filterValues = ordersResult.filterValues;
            var breadcrumbs = [
                {
                    htmlValue: Resource.msg('global.home', 'common', null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                    url: URLUtils.url('Account-Show').toString()
                }
            ];

            res.render('account/subscription/subscriptions', {
                subscriptions: subscriptions,
                filterValues: filterValues,
                orderFilter: req.querystring.orderFilter,
                accountlanding: false,
                breadcrumbs: breadcrumbs
            });
            next();
        }
    );

    server.get(
        'Details',
        csrfProtection.generateToken,
        consentTracking.consent,
        server.middleware.https,
        userLoggedIn.validateLoggedIn,
        function (req, res, next) {
            // sticky.io lacks the ability to correlate a given subscriptionID back to order numbers without making multiple calls
            // we will use the Subscriptions-List method to re-run the search for all active customer's orders, but only retain the data for the given subscriptionID
            // then we will merge that data with extended information of the order to allow manipulation of subscription options
            // while somewhat inefficient, this allows for direct linking to a subscription details page providing only the subscriptionID and without making many API calls outside of SFCC
            // and maintains security by only allowing the customer that is currently logged view a subscription if it is owned by an order belonging to that customer
            var SubscriptionHelpers = require('~/cartridge/scripts/subscription/subscriptionHelpers');

            var billingModels = stickyio.getBillingModelsFromStickyio(1, {});
            
            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id,
                billingModels
            );

            var order;
            var subscription;
            var currentCustomerNo;
            
            var sid = req.querystring.sid;
            var subscriptions = ordersResult.subscriptions;
            if (subscriptions.length > 0) {
                subscription = Object.assign(subscriptions[0], stickyio.getSubscriptionData(subscriptions[0].orderNumbers[0].stickyioOrderNo, subscriptions[0].subscriptionID, billingModels));
                order = OrderMgr.getOrder(subscription.orderNumbers[0].sfccOrderNo, subscription.orderNumbers[0].sfccOrderToken);
                currentCustomerNo = order.customer.profile.customerNo;
            }
           
            var orderCustomerNo = req.currentCustomer.profile.customerNo;
            var breadcrumbs = [
                {
                    htmlValue: Resource.msg('global.home', 'common', null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                    url: URLUtils.url('Account-Show').toString()
                },
                {
                    htmlValue: Resource.msg('label.subscriptionmanagement.orderheader', 'stickyio', null),
                    url: URLUtils.url('Subscriptions-List').toString()
                }
            ];
            var currentYear = new Date().getFullYear();
            var creditCardExpirationYears = [];
		
            for (var i = 0; i < 10; i++) {
                creditCardExpirationYears.push((currentYear + i).toString());
            }
		    
            var exitLinkText = Resource.msg('label.subscriptionmanagement.orderheader', 'stickyio', null);
            var exitLinkUrl = URLUtils.https('Subscriptions-List', 'orderFilter', req.querystring.orderFilter);
            var addressForm = server.forms.getForm('stickyAddress');
            addressForm.clear();
            var creditCardForm = server.forms.getForm('creditCard');
            creditCardForm.clear();

            // Check if product swap is enabled
            let stickyioProductSwapEnabled = Site.getCurrent().getCustomPreferenceValue('stickyioProductSwapEnabled');
            let stickyioDisableProductSwap = subscription.orderData.productLineItem.custom.stickyioDisableProductSwap;
            let isPrepaid = subscription.orderData.productLineItem.custom.stickyioTermsID.length == 1 && parseInt(subscription.orderData.productLineItem.custom.stickyioTermsID) == 0 ? false : true;
            let showProductSwapUI = stickyioProductSwapEnabled && !stickyioDisableProductSwap && !isPrepaid;
            subscription.orderData.productLineItem.custom.stickyOrderNumber = subscription.orderNumbers[0].stickyioOrderNo;

            // Get next recurring product data
            let nextRecurringProduct = stickyio.getNextRecurringProduct(subscription.subscriptionID);

            subscription.orderData.productLineItem.nextProductID = nextRecurringProduct.variantSku ? nextRecurringProduct.variantSku : nextRecurringProduct.masterSku;
            subscription.orderData.productLineItem.nextVariantID = nextRecurringProduct.nextVariantID;
            subscription.orderData.productLineItem.masterProductID = nextRecurringProduct.masterSku;
            subscription.orderData.productLineItem.quantity = nextRecurringProduct.quantity;

            subscription.orderData.nextProductName = subscription.orderData.name;
            if (subscription.orderData.productLineItem.productID != subscription.orderData.productLineItem.nextProductID) {
                let nextProduct = ProductMgr.getProduct(subscription.orderData.productLineItem.nextProductID);
                subscription.orderData.nextProductName = nextProduct ? nextProduct.name : '';
                
                let nextProductImages = nextProduct ? nextProduct.getImages('large') : null;
                if (nextProductImages) {
                    subscription.orderData.nextProductImage = {};
                    subscription.orderData.nextProductImage.absURL = nextProductImages[0].absURL.toString();
                    subscription.orderData.nextProductImage.alt = nextProductImages[0].alt;
                    subscription.orderData.nextProductImage.index = 0;
                    subscription.orderData.nextProductImage.title = nextProductImages[0].title;
                    subscription.orderData.nextProductImage.url = nextProductImages[0].url.toString();
                } else {
                    subscription.orderData.nextProductImage = subscription.orderData.image;
                }
            } else {
                subscription.orderData.nextProductImage = subscription.orderData.image;
            }

            if (order && orderCustomerNo === currentCustomerNo) { // additional check
                // make our productModelOption data easier to deal with
                res.render('account/subscriptionDetails', {
                    sid : sid,
                    subscription: subscription,
                    addressForm: addressForm,
                    creditCardForm: creditCardForm,
                    expirationYears : creditCardExpirationYears,
                    exitLinkText: exitLinkText,
                    exitLinkUrl: exitLinkUrl,
                    breadcrumbs: breadcrumbs,
                    showProductSwapUI: showProductSwapUI
                });
            } else if (subscriptions.length === 0) {
                res.render('account/subscriptionDetails', {
                    sid : sid,
                    subscription: null,
                    addressForm: addressForm,
                    creditCardForm: creditCardForm,
                    expirationYears : creditCardExpirationYears,
                    exitLinkText: exitLinkText,
                    exitLinkUrl: exitLinkUrl,
                    breadcrumbs: breadcrumbs
                });
            } else {
                res.redirect(URLUtils.url('Account-Show'));
            }
            next();
        }
    );

    server.get('Manage',
        server.middleware.https,
        csrfProtection.generateToken,
        userLoggedIn.validateLoggedInAjax,
        function (req, res, next) {
            var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

            var sid = req.querystring.sid;
            var action = req.querystring.action;
            var confirm = !!+req.querystring.confirm;
            var bmid = req.querystring.bmid ? req.querystring.bmid : null;
            var date = req.querystring.date ? req.querystring.date : null;

            var error = false;
            var message;
            var renderedTemplate;
            var quickViewFullDetailMsg;

            // need to make sure this order belongs to the logged in customer
            var ID = req.querystring.ID;
            var token = req.querystring.token ? req.querystring.token : null;
            var order = OrderMgr.getOrder(ID, token);

            let noteId = req.querystring.noteid;
            let noteText = req.querystring.note;

            if (!order
                || !token
                || token !== order.orderToken
                || order.customer.ID !== req.currentCustomer.raw.ID
            ) {
                error = Resource.msg('label.subscriptionmanagement.error', 'stickyio', null);
            }

            if (!error) { // make sure subscriptionID exists within this order
                var valid = false;
                var shipments = order.getShipments();
                for (var i = 0; i < shipments.length; i++) {
                    var thisShipment = shipments[i];
                    for (var j = 0; j < thisShipment.productLineItems.length; j++) {
                        var thisPLI = thisShipment.productLineItems[j];
                        if (thisPLI.custom.stickyioSubscriptionID === sid) { valid = true; break; }
                    }
                }
                if (!valid) {
                    error = Resource.msg('label.subscriptionmanagement.error', 'stickyio', null);
                }
            }

            var enterDialogMessage = 'Enter Dialogue Message'; // unused, but included because SFRA also includes it
            var closeButtonText = Resource.msg('button.subscriptionmanagement.close', 'stickyio', null);

            if (!error) {
                var stickyioAllowRecurring = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowRecurringDate');
                if (action === 'recur_at' && stickyioAllowRecurring !== true) {
                    error = Resource.msg('label.subscriptionmanagement.error', 'stickyio', null);
                }
                quickViewFullDetailMsg = Resource.msg('label.subscriptionmanagement.confirm', 'stickyio', null);
                message = Resource.msg('label.subscriptionmanagement.confim.' + action, 'stickyio', null);
            } else {
                quickViewFullDetailMsg = Resource.msg('label.subscriptionmanagement.error', 'stickyio', null);
            }

            // Cancellation notes
            let notes = [];
            let cancellationRequired = stickyio.getCancellationRequiredConfig();

            if (action === ACTION_CANCEL || action === ACTION_TERMINATE_NEXT) {
                let stickyioResponse = stickyio.getCancellationNoteTemplates();

                if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
                    for (let i = 0; i < stickyioResponse.object.result.data.length; i++) {    
                        let note = stickyioResponse.object.result.data[i];
                        notes[i] = {'id': note.id, 'note': note.name, 'editable': note.is_editable};
                    }
                }
            }

            var context = { error: error, message: message, ID: ID, token: token, sid: sid, action: action, bmid: bmid, date: date, notes: notes, cancellationRequired: cancellationRequired };
            var template = 'stickyio/subscriptionManagementConfirmation';
            renderedTemplate = renderTemplateHelper.getRenderedHtml(
                context,
                template
            );
            if (!error) {
                if (confirm) {
                    var stickyioResponse = stickyio.stickyioSubMan(ID, token, sid, action, bmid, date, req.currentCustomer.profile, noteId, noteText);
                    var url = req.httpHeaders.get('referer').replace(/&subscriptionmsg_([0-9a-f]{32}=[^&]*)?|^subscriptionmsg_([0-9a-f]{32}=[^&]*)?&?/, ''); // strip any existing stickyiomsg parameter off the URL
                    if (stickyioResponse.error) {
                        res.json({
                            error: stickyioResponse.error,
                            message: stickyioResponse.message.message,
                            redirectURL: url + '&subscription_error_msg_' + sid + '=' + stickyioResponse.message.message
                        });
                    } else {
                        res.json({
                            redirectURL: url + '&subscriptionmsg_' + sid + '=' + stickyioResponse.message
                        });
                    }
                } else {
                    res.json({
                        sid: sid,
                        action: action,
                        bmid: bmid,
                        date: date,
                        renderedTemplate: renderedTemplate,
                        quickViewFullDetailMsg: quickViewFullDetailMsg,
                        enterDialogMessage: enterDialogMessage,
                        closeButtonText: closeButtonText
                    });
                }
            } else {
                res.json({
                    error: true,
                    renderedTemplate: renderedTemplate,
                    quickViewFullDetailMsg: quickViewFullDetailMsg,
                    enterDialogMessage: enterDialogMessage,
                    closeButtonText: closeButtonText
                });
            }
            next();
        }
    );
    
    server.post('UpdateShippingAddress',
        server.middleware.https,
        csrfProtection.generateToken,
        userLoggedIn.validateLoggedInAjax,
        function (req, res, next) {
            var success = true;
            var sid = req.form.sid;
            var stickyOrderNo = req.form.stickyioOrderNo;
            
            var form = server.forms.getForm('stickyAddress');
            var addrLine1 = form.address1.value;
            var addrLine2 = form.address2.value;
            var city = form.city.value;
            var state = form.states.stateCode.value;
            var country = form.country.value; 
            var phone = form.phone.value;
            var postalCode = form.postalCode.value;
 
            var stickyioResponse = stickyio.updateShippingAddress(stickyOrderNo, addrLine1, addrLine2, city, state, postalCode, country, phone);     	
            if (stickyioResponse.error) {
                success = false;
            }
            res.json({
                success: success,
                message : stickyioResponse.message
            });
            next();		
    	}
    );
    
    server.post('UpdatePaymentInformation',
        server.middleware.https,
        csrfProtection.generateToken,
        userLoggedIn.validateLoggedInAjax,
        function (req, res, next) {
            var PaymentMgr = require('dw/order/PaymentMgr');
            var queryString = req.querystring;
            var success = true;
            var sid = req.form.sid;
            var stickyOrderNo = req.form.stickyioOrderNo;
            var form = server.forms.getForm('creditCard');
            
            var cardType = form.cardType.value;
            var cardNumber = form.cardNumber.value.replace(/\s/g, '');
            
            var expirationMonth = form.expirationMonth.value.toString();
            var expirationYear = form.expirationYear.value.toString();
            var cardSecurityCode = form.securityCode.value;
            var creditCardStatus;
            var message;
            
            var paymentCard = PaymentMgr.getPaymentCard(cardType);
						
            if (paymentCard) {
                creditCardStatus = paymentCard.verify(expirationMonth,expirationYear,cardNumber,cardSecurityCode);
            } else {
                success = false;
                message =  Resource.msg('error.invalid.card.number', 'creditCard', null);
            }
       		      		
            if (creditCardStatus.error) {
                success = false;
                message = Resource.msg('error.card.information.error', 'creditCard', null);
            }
            if (success) {            
                var stickyioResponse = stickyio.updateStickyioPaymentInformation(stickyOrderNo, cardType, cardNumber,cardSecurityCode,expirationMonth,expirationYear);     	
                if (stickyioResponse.error) {
                    success = false;
                    message = Resource.msg('error.card.information.error', 'creditCard', null);
                } else {
                    message = Resource.msg('label.subscriptionmanagement.response.payment.update', 'stickyio', null);
                }
            }

            res.json({
                success: success,
                message : message
            });
            next();		
    	}
    );
    
     server.post('Notification',
        server.middleware.https,
        function (req, res, next) {
            var success = true;
            
            var dwCryptoMessageDigest = require('dw/crypto/MessageDigest');
            var dwCryptoEncoding = require('dw/crypto/Encoding');
            var dwUtilBytes = require('dw/util/Bytes');
 
            var secret = Site.current.getCustomPreferenceValue('stickyioClientId');
            var salt = Site.current.getCustomPreferenceValue('stickyioClientPass');
            
            var dwSecretBytes = new dwUtilBytes(secret + salt);
            var dwDigestObj = new dwCryptoMessageDigest(dwCryptoMessageDigest['DIGEST_SHA_256']);
            var hash = dwCryptoEncoding.toBase64(dwDigestObj.digestBytes(dwSecretBytes));

           
            var contentType = req.httpHeaders.get('Content-Type') || req.httpHeaders.get('content-type');              
            var hashRequest = req.httpHeaders.get('X-Secret') || req.httpHeaders.get('x-secret');
            
            if (empty(hashRequest) || hashRequest !== hash){
                success = false;
            }
            if (success){
                var data = JSON.parse(req.httpParameterMap.requestBodyAsString);
                var emailType = data.emailType;
                var emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');
                
                var objectForEmail = {
                    firstName: data.firstName,
                    lastName: data.lastName
                };
                var emailObj = {
                    to: data.customer,
                    from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com'
                };
                var template;   
                var sendEmail = false;
                var enabled = true;
                switch (emailType) {
                    case 6: //Cancel
                        enabled = Site.current.getCustomPreferenceValue('stickyioCancelEmailEnabled');
                        if (enabled) {
                        	sendEmail = true;
                            emailObj.type = emailHelpers.emailTypes.stickyCancel;
                            emailObj.subject = Resource.msg('email.cancel.title','stickyio',null);
                            template = 'stickyio/email/stickySubscriptionCancel';
                        }
                        break;
                   case 14: //Subscription Reminder
                        enabled = Site.current.getCustomPreferenceValue('stickyioReminderEmailEnabled');
                        if (enabled) {
                        	sendEmail = true;
                            emailObj.type = emailHelpers.emailTypes.stickyReminder;
                            emailObj.subject = Resource.msg('email.reminder.title','stickyio',null);
                            objectForEmail.recurringDate = data.recurringDate;
                            objectForEmail.recurringAmt = data.recurringAmt;
                            objectForEmail.subscriptionId = data.subscriptionId;
                            template = 'stickyio/email/stickySubscriptionReminder';
                        }
                        break;
                    case 20: //Decline
                        enabled = Site.current.getCustomPreferenceValue('stickyioDeclineEmailEnabled');
                        if (enabled) {
                        	sendEmail = true;
                            emailObj.type = emailHelpers.emailTypes.stickyRebillDecline;
                            emailObj.subject = Resource.msg('email.rebill.decline.title','stickyio',null);
                            objectForEmail.declineReason = data.declineReason;
                            objectForEmail.orderTotal = data.orderTotal;
                            objectForEmail.subscriptionId = data.subscriptionId;
                            template = 'stickyio/email/stickySubscriptionRebillDecline';
                        }
                        break;
                    case 22: //Expired
                        enabled = Site.current.getCustomPreferenceValue('stickyioExpiredCardEmailEnabled');
                        if (enabled) {
                        	sendEmail = true;
                            emailObj.type = emailHelpers.emailTypes.stickyExpiredCard;
                            emailObj.subject = Resource.msg('email.expired.card.title','stickyio',null);
                            objectForEmail.subscriptionId = data.subscriptionId;
                            template = 'stickyio/email/stickySubscriptionExpiredCard';
                        }
                        break;
                    case 27: //Pause Confirmation
                        //Currently not supported on CRM but template was created
                        emailObj.type = emailHelpers.emailTypes.stickyPause;
                        emailObj.subject = Resource.msg('email.pause.title','stickyio',null);
                        objectForEmail.subscriptionId = data.subscriptionId;
                        template = 'stickyio/email/stickySubscriptionPause';
                        break;
                    case 28: //out of stock
                        //Currently not supported on CRM but template was created, 
                        emailObj.type = emailHelpers.emailTypes.stickyOutOfStock;
                        emailObj.subject = Resource.msg('email.out.stock.title','stickyio',null);
                        objectForEmail.subscriptionId = data.subscriptionId;
                        template = 'stickyio/email/stickySubscriptionOutStock';
                        break;
                    default:
                        sendEmail = false;
                }
                if (sendEmail) { 
                    emailHelpers.sendEmail(emailObj, template, objectForEmail);
                }
                  
            }
            
            res.json({
                success: success
            });
            next();     
        }
    );

    server.get('GetProduct', function (req, res, next) {
        let productLineItem = JSON.parse(req.querystring.productLineItem);
        let selectedQuantity = (req.querystring.quantity && parseInt(req.querystring.quantity) > 0) ? parseInt(req.querystring.quantity) : productLineItem.quantity;

        let swapProducts = JSON.stringify(stickyio.getSwapProducts(productLineItem.masterProductID));
        let newProductID = req.querystring.newProductID ? req.querystring.newProductID : '';
        let newProduct = newProductID ? ProductMgr.getProduct(newProductID.toString()) : null;
        let newProductName = newProduct ? newProduct.name : '';
        let images = newProduct ? newProduct.getImages('large') : null;
        let newProductImage = images ? images[0].absURL.toString() : '';
        let currencysymbol = Resource.msg('productdetail.currencysymbol.' + Site.getCurrent().getDefaultCurrency(), 'stickyio', '$');
        let priceDelta = newProduct ? (newProduct.priceModel.price.value * productLineItem.quantity - productLineItem.price) : 0;
        let newProductPriceDelta = priceDelta < 0 ? '-' + currencysymbol + Math.abs(priceDelta).toFixed(2) : '+' + currencysymbol + Math.abs(priceDelta).toFixed(2); 

        // Load current product info
        let pliProduct = {
            pid: newProductID ? newProductID : productLineItem.nextProductID,
            quantity: selectedQuantity
        };

        let product = ProductFactory.get(pliProduct);

        product.stickyio.stickyioOID = productLineItem.custom.stickyioOfferID;
        product.stickyio.stickyioBMID = productLineItem.custom.stickyioBillingModelID;
        product.stickyio.stickyioTID = productLineItem.custom.stickyioTermsID;
        product.stickyio.stickyioDisableProductSwap = productLineItem.custom.stickyioDisableProductSwap;
        product.stickyio.stickyioOneTimePurchase = false;
        product.stickyio.isProductSwap = true;

        let nextOfferId = 0;
        let nextBillingModelId = 0;

        // Set prepaid offer to hidden in order to hide it in the UI
        if (newProductID != '' && product.stickyio.offers) {
            let offerIds = [];
            let firstOfferId = 0;

            Object.keys(product.stickyio.offers).forEach(function (offerId) {
                offerIds.push(offerId)
            });

            for (let i = 0; i < offerIds.length; i++) {
                let offerId = offerIds[i];
                
                if (product.stickyio.offers[offerId].terms) {
                    product.stickyio.offers[offerId].hidden = true;
                } else {
                    if (firstOfferId == 0) 
                        firstOfferId = offerId;
                    
                    if (offerId == productLineItem.custom.stickyioOfferID)
                        nextOfferId = offerId;
                }
            }

            if (nextOfferId == 0) {
                nextOfferId = firstOfferId;
            }

            if (nextBillingModelId == 0) {
                let thisOffer = product.stickyio.offers[nextOfferId];
                let firstBillingModelId = 0;

                for (let i = 0; i < thisOffer.billingModels.length; i++) {
                    if (thisOffer.billingModels[i].id == productLineItem.custom.stickyioBillingModelID)
                        nextBillingModelId = productLineItem.custom.stickyioBillingModelID;
                    else if (firstBillingModelId == 0)
                        firstBillingModelId = thisOffer.billingModels[i].id
                }

                if (nextBillingModelId == 0)
                    nextBillingModelId = firstBillingModelId;
            }
        }

        let oldProduct = newProductID != '' ? ProductMgr.getProduct(productLineItem.nextProductID) : null;
        let oldProductName = oldProduct ? oldProduct.name : '';
        let oldImages = oldProduct ? oldProduct.getImages('small') : null;
        let oldProductImage = oldImages ? oldImages[0].absURL.toString() : '';

        let context = {
            productLineItem: productLineItem,
            product: product,
            swapProducts: swapProducts,
            newProductID: newProductID,
            newProductName: newProductName,
            newProductImage: newProductImage,
            newProductPriceDelta: newProductPriceDelta,
            oldProductName: oldProductName,
            oldProductImage: oldProductImage,
            nextOfferId: nextOfferId,
            nextBillingModelId: nextBillingModelId,
            template: 'product/productSwapQuickView.isml'
        };

        res.setViewData(context);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            let viewData = res.getViewData();

            res.json({
                renderedTemplate: renderTemplateHelper.getRenderedHtml(viewData, viewData.template)
            });
        });

        next();
    });

    server.get('GetSwapProduct', function (req, res, next) {
        let productLineItem = JSON.parse(req.querystring.productLineItem);
        let swapProducts = stickyio.getSwapProducts(productLineItem.masterProductID);
        let newProductID = req.querystring.newProductID;

        let context = {
            productLineItem: productLineItem,
            swapProducts: swapProducts,
            newProductID: newProductID,
            template: 'product/productSwapView.isml'
        };

        res.setViewData(context);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            let viewData = res.getViewData();

            res.json({
                renderedTemplate: renderTemplateHelper.getRenderedHtml(viewData, viewData.template)
            });
        });

        next();
    });

    server.get('SaveProduct', function (req, res, next) {
        let message = '';
        
        let productLineItem = JSON.parse(req.querystring.productLineItem);
        let newProductID = req.querystring.newProductID ? req.querystring.newProductID : productLineItem.nextProductID;
        let newRecurringQuantity = (req.querystring.quantity && parseInt(req.querystring.quantity) > 0) ? parseInt(req.querystring.quantity) : productLineItem.quantity;
        let newRecurringVariantId = req.querystring.newProductVariantID ? parseInt(req.querystring.newProductVariantID) : 0;

        let newProduct = newProductID ? ProductMgr.getProduct(newProductID.toString()) : null;
        if (newProduct && newRecurringVariantId && newRecurringVariantId > 0) {
            let stickyioResponse = stickyio.getVariants(newProduct.custom.stickyioProductID, true);
            if (stickyioResponse && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data) {
                for (let i = 0; i < stickyioResponse.object.result.data.length; i++) {
                    let variantProduct = stickyioResponse.object.result.data[i];
                    if (variantProduct.id == newRecurringVariantId) {
                        newProductID = variantProduct.sku_num;
                        newProduct = ProductMgr.getProduct(newProductID.toString());
                        break;
                    }
                }
            }
        }

        if (newProduct && (newProductID !== productLineItem.nextProductID || 
            newRecurringVariantId !== productLineItem.nextVariantID || 
            newRecurringQuantity !== productLineItem.quantity)) {
            message = Resource.msg('label.product_successfully_updated', 'stickyio', null);

            if (newProductID !== productLineItem.nextProductID)
                message = Resource.msg('label.product_successfully_swapped', 'stickyio', null);

            let stickyOrderNumber = productLineItem.custom.stickyOrderNumber;
            let stickyProductId = productLineItem.stickyProductID;
            let newRecurringProductId = newProduct.custom.stickyioProductID;
            let newRecurringProductPrice = newProduct.priceModel.price.value;

            let offerId = req.querystring.offer;
            let billingModelId = req.querystring.billingmodel;

            if (offerId > 0 || billingModelId > 0) {
                // Update the offer
                stickyio.subscriptionOrderUpdate(stickyOrderNumber, stickyProductId, newRecurringProductId, newRecurringVariantId, newRecurringQuantity, offerId, billingModelId, 0);
            }

            // Update next recurring product
            let responseMessage = stickyio.subscriptionOrderUpdate(stickyOrderNumber, stickyProductId, newRecurringProductId, newRecurringVariantId, newRecurringQuantity, 0, 0, newRecurringProductPrice);
            if (responseMessage != '') {
                message = Resource.msg('label.product_update_error', 'stickyio', null);
            }   
        } 
        
        res.json({
            message: message
        });

        next();
    });
}

module.exports = server.exports();
