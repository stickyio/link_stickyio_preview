'use strict';

var server = require('server');

var Site = require('dw/system/Site');
var stickyioEnabled = Site.getCurrent().getCustomPreferenceValue('stickyioEnabled');

if (stickyioEnabled) {
    var Resource = require('dw/web/Resource');
    var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
    var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
    var stickyio = require('~/cartridge/scripts/stickyio');

    server.get('ManageSubscription',
        server.middleware.https,
        csrfProtection.generateToken,
        userLoggedIn.validateLoggedInAjax,
        function (req, res, next) {
            var OrderMgr = require('dw/order/OrderMgr');
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
            var order = OrderMgr.getOrder(ID);
            var token = req.querystring.token ? req.querystring.token : null;

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
                    var stickyioResponse = stickyio.stickyioSubMan(ID, sid, action, bmid, date);
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
}

module.exports = server.exports();
