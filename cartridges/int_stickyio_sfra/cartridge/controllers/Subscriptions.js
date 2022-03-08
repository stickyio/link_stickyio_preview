'use strict';

var server = require('server');
var Site = require('dw/system/Site');
var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

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

            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id
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

            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id
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

            var ordersResult = SubscriptionHelpers.getSubscriptions(
                req.currentCustomer,
                req.querystring,
                req.locale.id
            );

            var order;
            var subscription;
            var currentCustomerNo;
            var subscriptionShippingAddress = null;
            
            var sid = req.querystring.sid;
            var subscriptions = ordersResult.subscriptions;
            if (subscriptions.length > 0) {
           		subscriptionShippingAddress = stickyio.getSubscriptionShippingAddress(sid);
                subscription = Object.assign(subscriptions[0], stickyio.getSubscriptionData(subscriptions[0].orderNumbers[0].stickyioOrderNo, subscriptions[0].subscriptionID));
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
 	        
            if (order && orderCustomerNo === currentCustomerNo) { // additional check
                // make our productModelOption data easier to deal with
                res.render('account/subscriptionDetails', {
                	sid : sid,
                    subscription: subscription,
                    subscriptionShippingAddress: subscriptionShippingAddress,
                    addressForm: addressForm,
                    creditCardForm: creditCardForm,
                    expirationYears : creditCardExpirationYears,
                    exitLinkText: exitLinkText,
                    exitLinkUrl: exitLinkUrl,
                    breadcrumbs: breadcrumbs
                });
            } else if (subscriptions.length === 0) {
                res.render('account/subscriptionDetails', {
                	sid : sid,
                    subscription: null,
                    subscriptionShippingAddress: subscriptionShippingAddress,
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

            var context = { error: error, message: message, ID: ID, token: token, sid: sid, action: action, bmid: bmid, date: date };
            var template = 'stickyio/subscriptionManagementConfirmation';
            renderedTemplate = renderTemplateHelper.getRenderedHtml(
                context,
                template
            );

            if (!error) {
                if (confirm) {
                    var stickyioResponse = stickyio.stickyioSubMan(ID, token, sid, action, bmid, date);
                    if (stickyioResponse.error) {
                        res.json({
                            error: stickyioResponse.error,
                            message: stickyioResponse.message.message
                        });
                    } else {
                        var url = req.httpHeaders.get('referer').replace(/&subscriptionmsg_([0-9a-f]{32}=[^&]*)?|^subscriptionmsg_([0-9a-f]{32}=[^&]*)?&?/, ''); // strip any existing stickyiomsg parameter off the URL
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
  			var form = server.forms.getForm('stickyAddress');

        	var addrLine1 = form.address1.value;
        	var addrLine2 = form.address2.value;
        	var city = form.city.value;
        	var state = form.states.stateCode.value;
        	var country = form.country.value; 
        	var phone = form.phone.value;
          	var postalCode = form.postalCode.value;

 
        	var stickyioResponse = stickyio.updateShippingAddress(sid, addrLine1, addrLine2, city, state, postalCode, country, phone);     	
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
        	var test = req.form;
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
}

module.exports = server.exports();
