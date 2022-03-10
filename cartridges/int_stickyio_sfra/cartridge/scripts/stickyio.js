/**
 * The main sticky.io library providing API connectivity,
 * object parsing, storage and retrieval, validation and helper functions.
 * Functions are selectively exported at the end for precise control.
*/

'use strict';

var Logger = require('dw/system/Logger');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var OrderMgr = require('dw/order/OrderMgr');
var ShippingMgr = require('dw/order/ShippingMgr');
var Calendar = require('dw/util/Calendar');
var Shipment = require('dw/order/Shipment');
var Order = require('dw/order/Order');
var OCAPI_VERSION = 'v19_10';
var subscriptionProductsLog = {};
var offerProductsLog = [];
var allStickyioProducts = {};

const BILLING_MODEL_TYPE_BY_CYCLE = 1;

/**
 * Mask sensitive data from HTTPClient API calls that may appear in logs
 * @param {Object} jsonObject - JSON request/response object
 * @returns {Object} - The masked JSON object
 */
function maskObject(jsonObject) {
    var maskKeys = ['acquisition_date', 'firstName', 'lastName', 'billingFirstName', 'billingLastName', 'billingAddress1',
        'billingAddress2', 'phone', 'email', 'creditCardNumber', 'card_number', 'expirationDate', 'CVV', 'expiry', 'ipAddress',
        'shippingAddress1', 'shippingAddress2', 'billing_first_name', 'billing_last_name', 'billing_street_address',
        'billing_street_address2', 'credit_card_number', 'cc_expires', 'cc_first_6', 'cc_last_4', 'cc_number',
        'cc_orig_first_6', 'cc_orig_last_4', 'customers_telephone', 'email_address', 'first_name', 'ip_address',
        'last_name', 'tracking_number', 'shipping_first_name', 'shipping_last_name', 'shipping_street_address',
        'shipping_street_address2']; // keys from/to sticky.io we want to mask
    var thisJSONObject = jsonObject;
    Object.keys(thisJSONObject).forEach(function (key) {
        if (maskKeys.map(function (maskKey) {
            return maskKey.toLowerCase(); // convert all keys to lowercase
        }).indexOf(key.toLowerCase()) !== -1) { // compare lowercase maskKeys to lowercase JSON key
            thisJSONObject[key] = '****'; // mask the JSON key
        }
    });
    return thisJSONObject;
}

/**
 * sticky.io API service caller
 * @param {string} svcName - The registered sticky.io service
 * @returns {Object} - The results of the parsed service response
 */
function stickyioAPI(svcName) {
    var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
    var svc = LocalServiceRegistry.createService(svcName, {
        createRequest: function (thisSvc, params) {
            var theseParams = params;
            var serviceConfig = thisSvc.getConfiguration();
            var serviceParts = serviceConfig.ID.split('.');
            var profileID = thisSvc.getConfiguration().profile.ID;
            var profileParts = profileID.split('.');
            var method = serviceParts[2].toUpperCase(); // based on our naming convention of stickyio.PROTOCOL.METHOD
            var endpoint = serviceParts[3].toLowerCase(); // based on our naming convention of stickyio.PROTOCOL.METHOD.ENDPOINT
            var version = profileParts[profileParts.length - 1];
            var url = thisSvc.getURL();
            url = url.replace('{HOST}', Site.getCurrent().getCustomPreferenceValue('stickyioAPIURL'));
            url = url.replace('{V}', version); // service calls may be using v1 or v2 API
            url = url.replace('{ENDPOINT}', endpoint + (theseParams ? (theseParams.id ? '/' + theseParams.id : '') + (theseParams.helper ? '/' + theseParams.helper : '') + (theseParams.id2 ? '/' + theseParams.id2 : '') : ''));
            if (theseParams.queryString) { url += '?' + theseParams.queryString; }
            thisSvc.setRequestMethod(method);
            thisSvc.setAuthentication('BASIC');
            thisSvc.addHeader('Content-Type', 'application/json');
            if (theseParams.headers) {
                var i;
                for (i = 0; i < theseParams.headers.length; i++) {
                    thisSvc.addHeader(theseParams.headers[i].key, theseParams.headers[i].value);
                }
            }
            thisSvc.setURL(url);
            if (theseParams && theseParams.body) { return JSON.stringify(theseParams.body); }
            return null;
        },
        parseResponse: function (thisSVC, result) {
            var error = false;
            var returnObject;
            if (result instanceof Object && (result.errorMessage || result.error_message)) {
                error = true;
                try {
                    returnObject = JSON.parse(result.errorMessage ? result.errorMessage : result.error_message);
                } catch (e) {
                    returnObject = result.errorMessage ? result.errorMessage : result.error_message;
                }
            } else {
                try {
                    returnObject = JSON.parse(result.text);
                    if (returnObject.errorMessage || (returnObject.error_message && !!JSON.parse(returnObject.error_found))) { error = true; }
                } catch (e) {
                    returnObject = result.text;
                }
            }
            return {
                error: error,
                result: returnObject
            };
        },
        getRequestLogMessage: function (request) {
            var requestJSON = JSON.parse(request);
            if (requestJSON) { requestJSON = maskObject(requestJSON); }
            return JSON.stringify(requestJSON);
        },
        filterLogMessage: function (msg) {
            return msg;
        },
        getResponseLogMessage: function (response) {
            var responseJSON = JSON.parse(response.text);
            if (responseJSON) { responseJSON = maskObject(responseJSON); }
            return JSON.stringify(responseJSON);
        }
    });
    return svc;
}

/**
 * sticky.io Single Sign-On method for CSR/Merchant access to the sticky.io portal.
 * @param {string} redirect - sticky.io url to open post authentication
 * @param {string} user - The usertype (this is arbitrary but will keep data separate in sticky.io)
 * @returns {Object} - The url with which to populate the iframe or a false status
 */
function sso(redirect, user) {
    var params = {};
    params.headers = [{ key: 'Uri-Domain', value: Site.current.httpsHostName }];
    params.helper = 'basic_auth';
    params.body = {};
    params.body.username = user;
    params.body.email = Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com';
    params.body.fullname = 'Customer Service';
    params.body.department_id = 'demandware';
    var stickyioResponse = stickyioAPI('stickyio.http.post.sso.basic_auth').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return stickyioResponse.object.result.data.url + '?redirect=' + redirect;
    }
    return false;
}

/**
 * Email sender for job processes
 * @param {string} emailAddress - Recipient email address
 * @param {string} body - Email body
 * @param {string} subject - Email subject
 * @returns {void}
 */
function sendNotificationEmail(emailAddress, body, subject) {
    var thisBody = body;
    var Mail = require('dw/net/Mail');
    var MimeEncodedText = require('dw/value/MimeEncodedText');
    if (thisBody === '') { thisBody = 'Nothing to do.'; }
    var mail = new Mail();
    mail.addTo(emailAddress);
    mail.setFrom(Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com');
    mail.setSubject(subject);
    mail.setContent(new MimeEncodedText(thisBody));
    mail.send();
}

/**
 * Retrieve all existing sticky.io Shipping Methods
 * @param {number} pageNum - Pagination page number
 * @param {Object} shippingMethods - Object of shipping methods from sticky.io
 * @returns {Object} - shippingMethods object
 */
function getShippingMethods(pageNum, shippingMethods) {
    var theseShippingMethods = shippingMethods;
    var thisPageNum = pageNum;
    var i;
    var params = {};
    if (!thisPageNum) { thisPageNum = 1; }
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.shipping').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        for (i = 0; i < stickyioResponse.object.result.data.length; i++) {
            var thisShippingMethod = stickyioResponse.object.result.data[i];
            theseShippingMethods[thisShippingMethod.id] = thisShippingMethod;
        }
        if (thisPageNum < parseInt(stickyioResponse.object.result.last_page, 10)) { thisPageNum++; getShippingMethods(thisPageNum, theseShippingMethods); }
    }
    return theseShippingMethods;
}

/**
 * Create a new Shipping Method in sticky.io
 * SFCC/OMS is responsible for shipping, so the service/freight codes do not matter
 * We override the cost of shipping when we create an order, so the amounts do no not matter
 * @param {dw.order.ShippingMethod} shippingMethod - SFCC Shipping Method
 * @returns {Object} - New sticky.io shipping method ID or false
 */
function createShippingMethod(shippingMethod) {
    var thisShippingMethod = shippingMethod;
    var params = {};
    params.body = {};
    params.body.name = thisShippingMethod.displayName;
    params.body.description = thisShippingMethod.description;
    // The rest of these fields are required, but do not matter
    params.body.type_id = 1;
    params.body.service_code = 'ABC';
    params.body.freight_code = 'ABCDE';
    params.body.amount_trial = 1;
    params.body.amount_recurring = 1;
    var stickyioResponse = stickyioAPI('stickyio.http.post.shipping').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        Transaction.wrap(function () { thisShippingMethod.custom.stickyioShippingID = stickyioResponse.object.result.data.id; });
        return stickyioResponse.object.result.data.id;
    }
    return false;
}

/**
 * Update an existing Shipping Method in sticky.io
 * @param {dw.order.ShippingMethod} shippingMethod - SFCC Shipping Method
 * @param {number} stickyioShippingMethodID - sticky.io Shipping Method ID
 * @returns {Object} - sticky.io shipping method ID or false
 */
function updateShippingMethod(shippingMethod, stickyioShippingMethodID) {
    var params = {};
    params.body = {};
    params.id = stickyioShippingMethodID;
    params.body.name = shippingMethod.displayName;
    params.body.description = shippingMethod.description;
    var stickyioResponse = stickyioAPI('stickyio.http.put.shipping').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return stickyioResponse.object.result.data.id;
    }
    return false;
}

/**
 * Update or create SFCC shipping methods in sticky.io
 * @param {Object} parameters - Parameters from the job that called this method
 * @returns {void}
 */
function updateShippingMethods(parameters) {
    var updatedShippingMethods = [];
    var stickyioShippingMethodIDs = [];
    var shippingMethods = ShippingMgr.getAllShippingMethods();
    var stickyioShippingMethods = getShippingMethods(null, {});
    var i;
    for (i = 0; i < shippingMethods.length; i++) {
        var thisShippingMethod = shippingMethods[i];
        var skip = false;
        if (stickyioShippingMethods && thisShippingMethod.custom.stickyioShippingID && stickyioShippingMethods[thisShippingMethod.custom.stickyioShippingID]) { // shipping method exists
            if (thisShippingMethod.displayName === stickyioShippingMethods[thisShippingMethod.custom.stickyioShippingID].name && thisShippingMethod.description === stickyioShippingMethods[thisShippingMethod.custom.stickyioShippingID].description) {
                skip = true;
            } else {
                var updatedShippingMethod = updateShippingMethod(thisShippingMethod, thisShippingMethod.custom.stickyioShippingID);
                if (updatedShippingMethod) { updatedShippingMethods.push('Updated sticky.io Shipping Method ' + thisShippingMethod.displayName + ' (' + updatedShippingMethod + ')'); }
            }
        } else { // this is a new shipping method
            var newShippingMethod = createShippingMethod(thisShippingMethod);
            if (newShippingMethod) { updatedShippingMethods.push('Created sticky.io Shipping Method ' + thisShippingMethod.displayName + ' (' + newShippingMethod + ')'); }
        }
        if (!skip && thisShippingMethod.custom.stickyioShippingID) { stickyioShippingMethodIDs.push(thisShippingMethod.custom.stickyioShippingID); }
    }

    if (stickyioShippingMethodIDs.length > 0) { // update the master sticky.io campaign to include these shipping methods
        var params = {};
        params.id = 1; // Master Campaign ID
        params.body = {};
        params.body.shipping_profiles = stickyioShippingMethodIDs;
        stickyioAPI('stickyio.http.put.campaigns').call(params);
        // no response from this necessary
    }

    var content = '';
    if (updatedShippingMethods.length > 0) {
        content = updatedShippingMethods.length + ' Created/Updated Shipping Methods\n';
        content += JSON.stringify(updatedShippingMethods, null, '\t');
        if (parameters['Email Log'] && parameters['Email Address'] !== '') {
            sendNotificationEmail(parameters['Email Address'].toString(), content, 'Shipping Method Update Log');
        }
    }
}

/**
 * Get product variants from sticky.io
 * @param {number} stickyioPID - sticky.io product ID
 * @param {boolean} raw - sticky.io product ID
 * @returns {Object} - Raw result of API call or Object with variants
 */
function getVariants(stickyioPID, raw) {
    var i;
    var j;
    var variantData = [];
    var params = {};
    params.id = stickyioPID;
    params.helper = 'variants';
    var stickyioResponse = stickyioAPI('stickyio.http.get.products.variants').call(params);
    if (raw) { return stickyioResponse; }
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
        for (i = 0; i < stickyioResponse.object.result.data.length; i++) {
            var thisVariant = stickyioResponse.object.result.data[i];
            var thisVariantProperties = '';
            for (j = 0; j < thisVariant.attributes.length; j++) {
                thisVariantProperties += thisVariant.attributes[j].attribute.option.name;
                if (j < (thisVariant.attributes.length - 1)) { thisVariantProperties += '/'; }
            }
            variantData.push({ id: thisVariant.id, sku_num: thisVariant.sku_num, attributes: thisVariantProperties });
        }
    }
    return variantData;
}

/** Get all existing MASTER products from sticky.io and return an Object of product_skus containing the product_id
 * @returns {Object} - Return object of products or false if no products
 *
 */
function getAllStickyioMasterProducts() {
    if (allStickyioProducts && Object.keys(allStickyioProducts).length > 0) { return allStickyioProducts; }
    var returnProducts = {};
    var params = {};
    params.body = {};
    params.body.product_id = 'all';
    var stickyioResponse = stickyioAPI('stickyio.http.post.product_index').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.response_code === '100' && parseInt(stickyioResponse.object.result.total_products, 10) > 0) {
        var thisProduct;
        Object.keys(stickyioResponse.object.result.products).forEach(function (thisProductID) {
            thisProduct = stickyioResponse.object.result.products[thisProductID];
            if (thisProduct.product_sku !== 'stickyioStraightSale') { // keep the straight sale product out
                returnProducts[thisProduct.product_sku] = { stickyioProductID: parseInt(thisProduct.product_id, 10), name: thisProduct.product_name };
            }
        });
        return returnProducts;
    }
    return false;
}

/** Get all existing variant products from sticky.io and return an Object of product_skus containing the product_id and variant_id
 * @param {Object} masterProducts - stickyio master products object
 * @returns {Object} - Return object of products or false if no products
 *
 */
function getAllStickyioVariantProducts(masterProducts) {
    var returnProducts = masterProducts;
    var i;
    for (i = 0; i < Object.keys(returnProducts).length; i++) {
        var thisMasterProduct = returnProducts[Object.keys(returnProducts)[i]];
        var stickyioResponse = getVariants(thisMasterProduct.stickyioProductID, true);
        if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data) {
            var j;
            for (j = 0; j < Object.keys(stickyioResponse.object.result.data).length; j++) {
                var variant = Object.keys(stickyioResponse.object.result.data)[j];
                var thisVariant = stickyioResponse.object.result.data[variant];
                returnProducts[thisVariant.sku_num] = { stickyioProductID: thisMasterProduct.stickyioProductID, stickyioVariantID: thisVariant.id, name: thisMasterProduct.name };
            }
        }
    }
    return returnProducts;
}

/**
 * Get the product IDs (SFCC and sticky.io) from the allStickyioProducts global object
 * @param {string} sfccProductID - SFCC sku/pid
 * @param {number} stickyioProductID - sticky.io product ID
 * @returns {Object} - Return IDs or false
 */
function getCorrespondingPIDandName(sfccProductID, stickyioProductID) {
    if (sfccProductID && stickyioProductID === 0 && allStickyioProducts && allStickyioProducts[sfccProductID]) { return { sfccProductID: sfccProductID, stickyioProductID: allStickyioProducts[sfccProductID].stickyioProductID, name: allStickyioProducts[sfccProductID].name }; }
    if (stickyioProductID !== 0 && allStickyioProducts) {
        var thisKey;
        var i;
        for (i = 0; i < Object.keys(allStickyioProducts).length; i++) {
            thisKey = Object.keys(allStickyioProducts)[i];
            if (allStickyioProducts[thisKey].stickyioProductID === stickyioProductID) { return { sfccProductID: thisKey, stickyioProductID: allStickyioProducts[thisKey].stickyioProductID, name: allStickyioProducts[thisKey].name }; }
        }
    }
    return false;
}

/**
 * Method to get the SFCC product type
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {Object} - Product type
*/
function getProductType(product) {
    if (product.isMaster()) { return 'master'; }
    if (product.isVariant()) {
        // an issue exists where a variant may be the only 'product' selected as a subscribeable, while the master and other variants are not
        // in stickyio, this gets created as a normal 'product' with only a PID and no VID - VID is required for a productType 'variant' to be checkout-able
        // SFCC still looks at this 'stand-alone variant' as a 'variant'
        if (product.masterProduct.custom.stickyioSubscriptionActive) { return 'variant'; }
        return 'product';
    }
    if (product.isProduct()) { return 'product'; }
    if (product.isProductSet()) { return 'productset'; }
    if (product.isBundle()) { return 'bundle'; }
    return null;
}

/**
 * Get Billing Models from sticky.io
 * @param {number} pageNum - Pagination page number
 * @param {Object} billingModels - Object containging billing models
 * @returns {Object} - Return billing models object
 */
function getBillingModelsFromStickyio(pageNum, billingModels) {
    var i;
    var thisPageNum = pageNum;
    var thisBillingModels = billingModels;
    var params = {};
    if (!thisPageNum) { thisPageNum = 1; }
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.billing_models').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        for (i = 0; i < stickyioResponse.object.result.data.length; i++) {
            var thisBillingModel = stickyioResponse.object.result.data[i];
            if (!thisBillingModel.is_archived) {
                thisBillingModels[thisBillingModel.id] = thisBillingModel; // change the billing model array in to an object with the id as key
            }
        }
        if (thisPageNum < parseInt(stickyioResponse.object.result.last_page, 10)) { thisPageNum++; getBillingModelsFromStickyio(thisPageNum, thisBillingModels); }
    }
    return thisBillingModels;
}

/**
 * Get Campaigns from sticky.io
 * @param {number} pageNum - Pagination page number
 * @param {Object} campaignData - Object containging campaignData
 * @returns {Object} - Return campaignData object
 */
function getCampaignsFromStickyio(pageNum, campaignData) {
    var i;
    var thisPageNum = pageNum;
    var thisCampaignData = campaignData;
    var params = {};
    if (!thisPageNum) { thisPageNum = 1; }
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.campaigns').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        for (i = 0; i < stickyioResponse.object.result.data.length; i++) {
            var thisCampaign = stickyioResponse.object.result.data[i];
            if (thisCampaign.is_active) {
                thisCampaignData[thisCampaign.id] = thisCampaign; // change the campaign array in to an object with the id as key
            }
        }
        if (thisPageNum < parseInt(stickyioResponse.object.result.last_page, 10)) { thisPageNum++; getCampaignsFromStickyio(thisPageNum, thisCampaignData); }
    }
    return thisCampaignData;
}

/**
 * sticky.io's Campaign object is not set up for SFCC to rapidly access data.
 * We reshape the object for local storage as a 'cache' in a custom object, keyed by
 * Campaign ID, Offer ID, and Billing Model ID.
 * @param {Object} campaignData - Campaign Data object from sticky.io
 * @returns {Object} - Return campaignData object
 */
function reshapeCampaignData(campaignData) {
    var thisCampaignData = campaignData;
    var thisCampaignID = 1; // hardcoded to only look at Campaign ID 1
    var offerObject = {};
    var termsObject = {};
    var i;
    var j;
    for (i = 0; i < thisCampaignData[thisCampaignID].offers.length; i++) {
        var thisOffer = thisCampaignData[thisCampaignID].offers[i];
        if (!thisOffer.is_archived) {
            offerObject[thisOffer.id] = thisOffer;
            delete offerObject[thisOffer.id].billing_models;
            delete offerObject[thisOffer.id].products;
            if (thisOffer.prepaid_profile && thisOffer.prepaid_profile.terms && thisOffer.prepaid_profile.terms.length > 0) {
                for (j = 0; j < thisOffer.prepaid_profile.terms.length; j++) { // site import is merge only
                    var thisTerm = thisOffer.prepaid_profile.terms[j];
                    var cycles = Number(parseInt(thisTerm.cycles, 10).toFixed(0));
                    termsObject[thisOffer.id + '-' + cycles] = { cycles: cycles, value: Number(parseInt(thisTerm.discount_value, 10).toFixed(0)), type: thisTerm.discount_type.name };
                }
            }
        }
    }
    return { offers: offerObject, terms: termsObject };
}

/**
 * Get sticky.io Campaigns custom object
 * @returns {Object} - SFCC Custom Object
*/
function getCampaignCustomObject() {
    return CustomObjectMgr.getCustomObject('stickyioCampaigns', 'campaigns');
}

/**
 * Get sticky.io Campaigns custom object JSON data
 * @returns {Object} - sticky.io campaign data
*/
function getCampaignCustomObjectJSON() {
    var campaignJSON = getCampaignCustomObject();
    if (campaignJSON) { return JSON.parse(getCampaignCustomObject().custom.jsonData); }
    return null;
}

/**
 * Get sticky.io Offer IDs
 * @returns {Object} - Array of offer IDs
*/
function getOfferIDs() {
    var offerIDs = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON();
    try {
        offerIDs = Object.keys(stickyioCampaigns.offers);
        if (offerIDs.updateSFCC) { offerIDs.splice(offerIDs.indexOf('updateSFCC'), 1); }
    } catch (e) {
        return [];
    }
    return offerIDs;
}

/**
 * Get sticky.io Billing Model IDs
 * @returns {Array} - Array of billing model IDs
*/
function getBillingModelIDs() {
    var billingModelIDs = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON();
    try {
        billingModelIDs = Object.keys(stickyioCampaigns.billingModels);
        if (billingModelIDs.updateSFCC) { billingModelIDs.splice(billingModelIDs.indexOf('updateSFCC'), 1); }
    } catch (e) {
        return [];
    }
    return billingModelIDs;
}

/**
 * Get sticky.io synced products
 * @returns {Array} - Array of SFCC product IDs
*/
function getCampaignProducts() {
    var pids = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON();
    try {
        pids = Object.keys(stickyioCampaigns.products);
        if (pids.updateSFCC) { pids.splice(pids.indexOf('updateSFCC'), 1); }
    } catch (e) {
        return [];
    }
    return pids;
}

/**
 * Get selected offerIDs for a given SFCC Product
* @param {dw.catalog.Product} product - SFCC Product
 * @returns {Array} - Array of stickyio Offer IDs
 */
function getSelectedOfferIDs(product) {
    var offerIDs = [];
    var i;
    for (i = 1; i <= 3; i++) { // currently support 3 offers
        var thisOfferIDObject = 'stickyioOffer' + i;
        if (product.custom[thisOfferIDObject].value !== null && offerIDs.indexOf(product.custom[thisOfferIDObject].value.toString === -1)) { offerIDs.push(product.custom[thisOfferIDObject].value.toString()); }
    }
    return offerIDs;
}

/**
 * Get selected billing model IDs for a given SFCC Product
* @param {dw.catalog.Product} product - SFCC Product
* @returns {Object} - stickyio Billing Model IDs
 */
function getSelectedBillingModelIDs(product) {
    var billingModelIDs = {};
    var i;
    for (i = 1; i <= 3; i++) { // currently support 3 sets of billing models
        var thisBillingModelObject = 'stickyioBillingModels' + i;
        if (product.custom[thisBillingModelObject] && product.custom[thisBillingModelObject].length > 0) {
            var j;
            for (j = 0; j < product.custom[thisBillingModelObject].length; j++) {
                var thisBillingModelID = product.custom[thisBillingModelObject][j].value;
                if (!billingModelIDs[thisBillingModelID]) { billingModelIDs[thisBillingModelID] = {}; }
            }
        }
    }
    return billingModelIDs;
}


/**
 * Generate XML import file - full replace for metadata
 * @param {boolean} blank - create blank archive
 * @param {Object} offers - offers to update
 * @param {Object} terms - pre-paid terms to update
 * @param {Object} billingModels - billingModels to update
 * @returns {void}
 */
function createSystemObjectXML(blank, offers, terms, billingModels) {
    var File = require('dw/io/File');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLStreamWriter');
    var siteContainerFolder = new File('/IMPEX/src/stickyTemp/');
    if (!siteContainerFolder.exists()) { siteContainerFolder.mkdir(); }
    var metaFolder = new File('/IMPEX/src/stickyTemp/meta/');
    if (!metaFolder.exists()) { metaFolder.mkdir(); }
    var file = new File('/IMPEX/src/stickyTemp/meta/system-objecttype-extensions.xml');
    if (!file.exists()) { file.createNewFile(); }
    var fileWriter = new FileWriter(file, 'UTF-8');
    var xsw = new XMLStreamWriter(fileWriter);
    /* eslint-disable indent */
    xsw.writeStartDocument('UTF-8', '1.0');
    xsw.writeStartElement('metadata');
        xsw.writeDefaultNamespace('http://www.demandware.com/xml/impex/metadata/2006-10-31');
        if (!blank) {
            xsw.writeStartElement('type-extension');
            xsw.writeAttribute('type-id', 'Product');
                xsw.writeStartElement('custom-attribute-definitions');
                    var i;
                    var j;
                    if (offers.length > 0) {
                        for (i = 1; i <= 3; i++) { // three hard-coded offer limit
                            xsw.writeStartElement('attribute-definition');
                                xsw.writeAttribute('attribute-id', 'stickyioOffer' + i);
                                xsw.writeStartElement('display-name');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Offer ' + i);
                                xsw.writeEndElement();
                                xsw.writeStartElement('description');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Offer created in sticky.io');
                                xsw.writeEndElement();
                                xsw.writeStartElement('type');
                                    xsw.writeCharacters('enum-of-string');
                                xsw.writeEndElement();
                                xsw.writeStartElement('localizable-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('site-specific-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('mandatory-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('visible-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-managed-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('order-required-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-defined-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('select-multiple-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('value-definitions');
                                for (j = 0; j < offers.length; j++) {
                                    xsw.writeStartElement('value-definition');
                                        xsw.writeStartElement('display');
                                            xsw.writeCharacters(offers[j].name);
                                        xsw.writeEndElement();
                                        xsw.writeStartElement('value');
                                            xsw.writeCharacters(offers[j].id);
                                        xsw.writeEndElement();
                                    xsw.writeEndElement();
                                }
                                xsw.writeEndElement();
                            xsw.writeEndElement();
                        }
                    }
                    if (terms.length > 0) {
                        for (i = 1; i <= 3; i++) { // three hard-coded term limit
                            xsw.writeStartElement('attribute-definition');
                                xsw.writeAttribute('attribute-id', 'stickyioTerms' + i);
                                xsw.writeStartElement('display-name');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Terms');
                                xsw.writeEndElement();
                                xsw.writeStartElement('description');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Pre-paid terms created in sticky.io');
                                xsw.writeEndElement();
                                xsw.writeStartElement('type');
                                    xsw.writeCharacters('enum-of-string');
                                xsw.writeEndElement();
                                xsw.writeStartElement('localizable-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('site-specific-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('mandatory-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('visible-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-managed-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('order-required-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-defined-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('select-multiple-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('value-definitions');
                                for (j = 0; j < terms.length; j++) {
                                    xsw.writeStartElement('value-definition');
                                        xsw.writeStartElement('display');
                                            xsw.writeCharacters(terms[j].cycles + '/' + terms[j].value + '/' + terms[j].type);
                                        xsw.writeEndElement();
                                        xsw.writeStartElement('value');
                                            xsw.writeCharacters(terms[j].id);
                                        xsw.writeEndElement();
                                    xsw.writeEndElement();
                                }
                                xsw.writeEndElement();
                            xsw.writeEndElement();
                        }
                    }
                    if (billingModels.length > 0) {
                        for (i = 1; i <= 3; i++) { // three hard-coded offer limit
                            xsw.writeStartElement('attribute-definition');
                                xsw.writeAttribute('attribute-id', 'stickyioBillingModels' + i);
                                xsw.writeStartElement('display-name');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Billing Models');
                                xsw.writeEndElement();
                                xsw.writeStartElement('description');
                                xsw.writeAttribute('xml:lang', 'x-default');
                                    xsw.writeCharacters('Billing Models created in sticky.io');
                                xsw.writeEndElement();
                                xsw.writeStartElement('type');
                                    xsw.writeCharacters('enum-of-string');
                                xsw.writeEndElement();
                                xsw.writeStartElement('localizable-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('site-specific-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('mandatory-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('visible-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-managed-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('order-required-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('externally-defined-flag');
                                    xsw.writeCharacters('false');
                                xsw.writeEndElement();
                                xsw.writeStartElement('select-multiple-flag');
                                    xsw.writeCharacters('true');
                                xsw.writeEndElement();
                                xsw.writeStartElement('value-definitions');
                                for (j = 0; j < billingModels.length; j++) {
                                    xsw.writeStartElement('value-definition');
                                        xsw.writeStartElement('display');
                                            xsw.writeCharacters(billingModels[j].name);
                                        xsw.writeEndElement();
                                        xsw.writeStartElement('value');
                                            xsw.writeCharacters(billingModels[j].id);
                                        xsw.writeEndElement();
                                    xsw.writeEndElement();
                                }
                                xsw.writeEndElement();
                            xsw.writeEndElement();
                        }
                    }
                xsw.writeEndElement();
            xsw.writeEndElement();
        }
    xsw.writeEndElement();
    xsw.writeEndDocument();
    xsw.close();
    /* eslint-enable indent */
    fileWriter.close();
    var zipFile = new File('/IMPEX/src/instance/stickyTemp.zip');
    siteContainerFolder.zip(zipFile);
}

/**
 * Get SFCC site catalog IDs via OCAPI bridge
 * @returns {Array} catalogIDs - Array of catalogIDs
 */
function getCatalogIDs() {
    var catalogIDs = [];
    var params = {};
    var body = {};
    body.method = 'get';
    body.uri = 's/-/dw/data/' + OCAPI_VERSION + '/catalogs';
    body.hostname = Site.current.httpsHostName;
    body.isClient = 'false';
    params.body = body;
    params.helper = 'sfccbridge';
    var stickyioResponse = stickyioAPI('stickyio.http.post.providers.sfccbridge').call(params);
    if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data && !stickyioResponse.object.result.data.statusCode)) {
        var i;
        for (i = 0; i < stickyioResponse.object.result.data.data.length; i++) {
            catalogIDs.push(stickyioResponse.object.result.data.data[i].id);
        }
    }
    return catalogIDs;
}

/**
 * Bind our shared product options to catalogs
 * @param {Object} sharedProductOptionsToBind -sharedProductOptions to bind
 * @returns {boolean} - result
 */
function bindSharedProductOptions(sharedProductOptionsToBind) {
    var i;
    var j;
    for (i = 0; i < Object.keys(sharedProductOptionsToBind).length; i++) {
        var thisCatalogID = Object.keys(sharedProductOptionsToBind)[i];
        for (j = 0; j < sharedProductOptionsToBind[thisCatalogID].length; j++) {
            var thisSharedProductOption = sharedProductOptionsToBind[thisCatalogID][j];
            var params = {};
            var body = {};
            body.method = 'put';
            body.uri = 's/-/dw/data/' + OCAPI_VERSION + '/catalogs/' + thisCatalogID + '/shared_product_options/' + thisSharedProductOption;
            body.hostname = Site.current.httpsHostName;
            body.isClient = 'false';
            body.data = JSON.stringify({ id: thisSharedProductOption, sorting_mode: 'byexplicitorder' });
            params.body = body;
            params.helper = 'sfccbridge';
            var stickyioResponse = stickyioAPI('stickyio.http.post.providers.sfccbridge').call(params);
            if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data && stickyioResponse.object.result.data.statusCode)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Make sure our shared product options are bound to all site catalogs
 * @param {Array} catalogIDs - Array of catalogIDs
 * @returns {boolean} - result
 */
function checkSharedProductOptions(catalogIDs) {
    var result = false;
    var sharedProductOptionsToBind = {};
    var sharedProductOptions = ['stickyioOfferOptions', 'stickyioBillingModelOptions', 'stickyioTermOptions'];
    var i;
    var j;
    for (i = 0; i < catalogIDs.length; i++) {
        var thisCatalogID = catalogIDs[i];
        for (j = 0; j < sharedProductOptions.length; j++) {
            var thisSharedProductOption = sharedProductOptions[j];
            var params = {};
            var body = {};
            body.method = 'get';
            body.uri = 's/-/dw/data/' + OCAPI_VERSION + '/catalogs/' + thisCatalogID + '/shared_product_options/' + thisSharedProductOption;
            body.hostname = Site.current.httpsHostName;
            body.isClient = 'false';
            params.body = body;
            params.helper = 'sfccbridge';
            var stickyioResponse = stickyioAPI('stickyio.http.post.providers.sfccbridge').call(params);
            if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data && stickyioResponse.object.result.data.statusCode === 404)) { // sharedProductOption is not bound to this catalog
                if (!sharedProductOptionsToBind[thisCatalogID]) { sharedProductOptionsToBind[thisCatalogID] = []; }
                sharedProductOptionsToBind[thisCatalogID].push(thisSharedProductOption);
            }
        }
    }
    if (Object.keys(sharedProductOptionsToBind).length > 0) { // we have sharedProductOptions that need to be bound
        result = bindSharedProductOptions(sharedProductOptionsToBind);
    } else {
        result = true;
    }
    return result;
}

/**
 * Generate stickyio SFCC system objects with the latest data from stickyio via XML import - merge only - and OCAPI bridge
 * @param {Array} catalogIDs - Array of catalogIDs
 * @param {Object} sharedOptionValueObject - object of offers, terms, and billingModels
 * @returns {boolean} - result
 */
function addSharedProductOptionValues(catalogIDs, sharedOptionValueObject) {
    var thisSharedOptionValueObject = sharedOptionValueObject;
    thisSharedOptionValueObject.stickyioBillingModelOptions.push({ id: 2, name: 'Straight Sale' }); // we inject this here for promotion targetting
    thisSharedOptionValueObject.stickyioBillingModelOptions.push({ id: 0 }); // we inject this here for promotion targetting
    thisSharedOptionValueObject.stickyioOfferOptions.push({ id: 0 }); // we inject this here for promotion targetting
    thisSharedOptionValueObject.stickyioTermOptions.push({ id: 0 }); // we inject this here for promotion targetting
    var i;
    var j;
    var k;
    for (i = 0; i < catalogIDs.length; i++) {
        var thisCatalogID = catalogIDs[i];
        for (j = 0; j < Object.keys(thisSharedOptionValueObject).length; j++) {
            var thisSharedProductOptionID = Object.keys(thisSharedOptionValueObject)[j];
            var thisSharedProductOptionValues = thisSharedOptionValueObject[thisSharedProductOptionID];
            for (k = 0; k < thisSharedProductOptionValues.length; k++) {
                var thisSharedProductOptionValue = thisSharedProductOptionValues[k];
                var params = {};
                var body = {};
                body.method = 'put';
                body.uri = 's/-/dw/data/' + OCAPI_VERSION + '/catalogs/' + thisCatalogID + '/shared_product_options/' + thisSharedProductOptionID + '/values/' + thisSharedProductOptionValue.id;
                body.hostname = Site.current.httpsHostName;
                body.isClient = 'false';
                var value = {};
                if (thisSharedProductOptionValue.name) {
                    value.value = { default: thisSharedProductOptionValue.name };
                }
                if (thisSharedProductOptionValue.id === 0) {
                    value.default_product_option_value = true;
                }
                value.option_prices = [{ currency_mnemonic: 'USD', value: 0 }];
                body.data = JSON.stringify(value);
                params.body = body;
                params.helper = 'sfccbridge';
                var stickyioResponse = stickyioAPI('stickyio.http.post.providers.sfccbridge').call(params);
                if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data && stickyioResponse.object.result.data.statusCode)) {
                    return false;
                }
            }
        }
    }
    return true;
}

/**
 * Adds shared product options to a subscription product
 * @param {Object} products - subscription products
 * @returns {void}
 */
function updateProductOptions(products) {
    var sharedProductOptions = ['stickyioOfferOptions', 'stickyioBillingModelOptions', 'stickyioTermOptions'];
    var i;
    var j;
    for (i = 0; i < Object.keys(products).length; i++) {
        var thisProductID = Object.keys(products)[i];
        if (thisProductID !== 'updateSFCC' && ProductMgr.getProduct(thisProductID)) {
            for (j = 0; j < sharedProductOptions.length; j++) {
                var thisSharedProductOption = sharedProductOptions[j];
                var params = {};
                var body = {};
                body.method = 'put';
                body.uri = 's/-/dw/data/' + OCAPI_VERSION + '/products/' + thisProductID + '/product_options/' + thisSharedProductOption;
                body.hostname = Site.current.httpsHostName;
                body.isClient = 'false';
                body.data = JSON.stringify({ id: thisSharedProductOption, shared: true });
                params.body = body;
                params.helper = 'sfccbridge';
                stickyioAPI('stickyio.http.post.providers.sfccbridge').call(params);
            }
        }
    }
}

/**
 * Generate stickyio SFCC system objects with the latest data from stickyio via XML import - merge only - and OCAPI bridge
 * @param {Object} products - subscription products
 * @param {Object} offers - offers
 * @param {Object} terms - pre-paid terms
 * @param {Object} billingModels - billingModels
 * @returns {void}
 */
function generateProductOptions(products, offers, terms, billingModels) {
    var catalogIDs = getCatalogIDs();
    var checkSharedProductOptionsResult;
    var addSharedProductOptionValuesResult;
    if (catalogIDs.length > 0) { checkSharedProductOptionsResult = checkSharedProductOptions(catalogIDs); }
    if (checkSharedProductOptionsResult) { addSharedProductOptionValuesResult = addSharedProductOptionValues(catalogIDs, { stickyioOfferOptions: offers, stickyioTermOptions: terms, stickyioBillingModelOptions: billingModels }); }
    if (addSharedProductOptionValuesResult) { updateProductOptions(products); }
}

/**
 * Generate stickyio SFCC system objects with the latest data from stickyio via XML import - merge only - and OCAPI bridge
 * @returns {void}
 */
function generateObjects() {
    var updateOffers = [];
    var updateTerms = [];
    var updateBillingModels = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON(); // get our latest campaignJSON
    var i;
    if (stickyioCampaigns.offers && stickyioCampaigns.offers.updateSFCC) { // offers
        for (i = 0; i < Object.keys(stickyioCampaigns.offers).length; i++) {
            var thisOfferID = Object.keys(stickyioCampaigns.offers)[i];
            if (thisOfferID !== 'updateSFCC') {
                var thisOffer = stickyioCampaigns.offers[thisOfferID];
                updateOffers.push({ id: thisOfferID, name: thisOffer.name });
            }
        }
    }
    if (stickyioCampaigns.terms && stickyioCampaigns.terms.updateSFCC) { // terms
        for (i = 0; i < Object.keys(stickyioCampaigns.terms).length; i++) {
            var thisTermID = Object.keys(stickyioCampaigns.terms)[i];
            if (thisTermID !== 'updateSFCC') {
                var thisTerm = stickyioCampaigns.terms[thisTermID];
                var discount = '';
                if (thisTerm.value && thisTerm.value.toString() !== '0' && thisTerm.value.toString() !== '0.00') {
                    discount = thisTerm.type === 'Amount' ? '$' + parseInt(thisTerm.value, 10).toFixed(2) : thisTerm.value + '%';
                    discount = ' at ' + discount + ' off';
                }
                var name = thisTerm.cycles + ' cycles' + discount;
                updateTerms.push({ id: thisTermID, cycles: thisTerm.cycles, value: thisTerm.value, type: thisTerm.type, name: name });
            }
        }
    }
    if (stickyioCampaigns.billingModels && stickyioCampaigns.billingModels.updateSFCC) { // offers
        for (i = 0; i < Object.keys(stickyioCampaigns.billingModels).length; i++) {
            var thisBMID = Object.keys(stickyioCampaigns.billingModels)[i];
            if (thisBMID !== 'updateSFCC') {
                var thisBM = stickyioCampaigns.billingModels[thisBMID];
                if (thisBMID !== '2') { updateBillingModels.push({ id: thisBMID, name: thisBM.name }); } // exclude straight sale billing model
            }
        }
    }
    if (updateOffers.length > 0 || updateBillingModels.length > 0 || updateTerms.length > 0) {
        createSystemObjectXML(false, updateOffers, updateTerms, updateBillingModels);
        generateProductOptions(stickyioCampaigns.products, updateOffers, updateTerms, updateBillingModels);
    } else {
        createSystemObjectXML(true, null, null, null);
    }
}

/**
 * Remove temporary file objects
 * @returns {void}
 */
function cleanupFiles() {
    var File = require('dw/io/File');
    var file = new File('/IMPEX/src/stickyTemp/meta/system-objecttype-extensions.xml');
    if (file.exists()) { file.remove(); }
    var metaFolder = new File('/IMPEX/src/stickyTemp/meta/');
    if (metaFolder.exists()) { metaFolder.remove(); }
    var siteContainerFolder = new File('/IMPEX/src/stickyTemp/');
    if (siteContainerFolder.exists()) { siteContainerFolder.remove(); }
    var zipFile = new File('/IMPEX/src/instance/stickyTemp.zip');
    if (zipFile.exists()) { zipFile.remove(); }
}

/**
 * Method to make sure selected billing models and offer actually exist in our custom object campaign data
 * of sticky.io Campaign/Offer/Billing Models
 * @param {dw.catalog.Product} product - Product
 * @param {boolean} allowTransaction - Allow a transaction to update the custom sticky.io property
 * (only true whenfunction is not in a storefront context)
 * @returns {boolean} - boolean result
*/
function validateProduct(product, allowTransaction) {
    var i;
    var thisProduct = product;
    if (thisProduct && allowTransaction) { // check to make sure this product has all shared product options that it should, and if not, add them via OCAPI
        var sharedProductOptions = ['stickyioOfferOptions', 'stickyioBillingModelOptions', 'stickyioTermOptions'];
        for (i = 0; i < sharedProductOptions.length; i++) {
            if (!thisProduct.optionModel.getOption(sharedProductOptions[i])) {
                var productToUpdate = {};
                productToUpdate[thisProduct.ID] = true;
                updateProductOptions(productToUpdate);
                break;
            }
        }
    }
    var campaignProducts = getCampaignProducts();
    if ((thisProduct && campaignProducts.length === 0) || (campaignProducts.length > 0 && campaignProducts.indexOf(thisProduct.ID) === -1)) { // SFCC product ID not found in campaign object - it hasn't been synced
        if (allowTransaction === true) {
            Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; });
        }
        return false;
    }
    var selectedOffers = getSelectedOfferIDs(thisProduct);
    if (thisProduct && selectedOffers.length > 0) {
        var productOffers = getOfferIDs();
        for (i = 0; i < selectedOffers.length; i++) {
            if (productOffers.length === 0 || (productOffers.length > 0 && selectedOffers[i] !== null && productOffers.indexOf(selectedOffers[i].toString()) === -1)) { // selected offer id not found for the master campaign. probably need a resync
                if (allowTransaction === true) {
                    Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; });
                }
                return false;
            }
        }
    }
    var selectedBillingModels = getSelectedBillingModelIDs(thisProduct);
    if (thisProduct && Object.keys(selectedBillingModels).length > 0) {
        // offer is good, proceed to check billing models
        var productBillingModels = getBillingModelIDs();
        for (i = 0; i < Object.keys(selectedBillingModels).length; i++) {
            var thisBillingModelID = Object.keys(selectedBillingModels)[i];
            if (productBillingModels.length === 0 || (productBillingModels.length > 0 && productBillingModels.indexOf(thisBillingModelID) === -1)) { // billing model id not found for this offer
                if (allowTransaction === true) {
                    Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; });
                }
                return false;
            }
        }
        if (allowTransaction === true) { Transaction.wrap(function () { thisProduct.custom.stickyioReady = true; }); }
        return true;
    }
    // catch-all
    if (allowTransaction === true) { Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; }); }
    return false;
}

/**
 * Method to look at all subscripton products that have campaign and offer IDs
 * and make sure their campaigns and offers still exist
 * (active is taken care of during the getCampaigns step)
 * if the campaign or offer is missing, remove the cid/oid stored
 * value from the product front-end code will prevent the product from being sellable
 * @returns {void}
*/
function validateAllProducts() {
    var products = ProductMgr.queryAllSiteProducts();
    while (products.hasNext()) {
        var product = products.next();
        if (product && product.custom.stickyioSubscriptionActive === true) {
            validateProduct(product, true);
        }
    }
    products.close();
}

/**
 * Make sure passed object is of type object and not null
 * @param {Object} object - Potential object
 * @returns {boolean} - true or false
 */
function isObject(object) {
    return object != null && typeof object === 'object';
}

/**
 * Deep compare two objects
 * @param {Object} object1 - Object 1
 * @param {Object} object2 - Object 2
 * @returns {boolean} - true or false
 */
function deepEqual(object1, object2) {
    var keys1 = Object.keys(object1);
    var keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    var i;
    for (i = 0; i < keys1.length; i++) {
        var key = keys1[i];
        var val1 = object1[key];
        var val2 = object2[key];
        var areObjects = isObject(val1) && isObject(val2);
        if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
            return false;
        }
    }
    return true;
}

/**
 * Make sure the stored campaignJSON data is reflected in the custom system object attributes and shared product options
 * @param {string} objectName - custom sticky.io system object name
 * @param {string} productID - SFCC productID - any SFCC PID that we can use to pull system object definitions
 * @param {Object} campaignJSON - custom object campaignJSON
 * @returns {boolean} - true or false
 */
function validateStickySystemObjects(objectName, productID, campaignJSON) {
    if (productID) {
        var systemObjectName;
        var sharedProductOptionName;
        if (objectName === 'offers') {
            systemObjectName = 'stickyioOffer1';
            sharedProductOptionName = 'stickyioOfferOptions';
        } else if (objectName === 'billingModels') {
            systemObjectName = 'stickyioBillingModels1';
            sharedProductOptionName = 'stickyioBillingModelOptions';
        } else {
            systemObjectName = 'stickyioTerms1';
            sharedProductOptionName = 'stickyioTermOptions';
        }
        var product = ProductMgr.getProduct(productID);
        if (product) {
            // check system object custom attributes
            var typeDef = product.describe();
            var attrDef = typeDef.getCustomAttributeDefinition(systemObjectName); // pull all attribute definitions from system object (should be identical across all three)
            var valueDefs = attrDef.getValues();
            var valid = false;
            var i;
            var j;
            for (i = 0; i < valueDefs.length; i++) {
                var thisSystemID = valueDefs[i].value;
                for (j = 0; j < Object.keys(campaignJSON).length; j++) {
                    if (thisSystemID.toString() === Object.keys(campaignJSON)[j].toString()) { // this system custom object ID exists
                        valid = true;
                        break;
                    }
                }
                if (!valid) {
                    return false; // something doesn't exist, so rebuild the whole object
                }
            }
            // now check shared product options to make sure they match as well
            var productOption = product.optionModel.getOption(sharedProductOptionName);
            if (!productOption) { return false; }
            var productOptionValues = productOption.optionValues;
            if (!productOptionValues || productOptionValues.length === 0) { return false; }
            for (i = 0; i < productOptionValues.length; i++) {
                var thisProductOptionID = productOptionValues[i].ID;
                for (j = 0; j < Object.keys(campaignJSON).length; j++) {
                    if (thisProductOptionID.toString() === Object.keys(campaignJSON)[j].toString()) { // this shared product option ID exists
                        valid = true;
                        break;
                    }
                }
                if (!valid) {
                    return false; // something doesn't exist, so rebuild the whole object
                }
            }
        }
    }
    return true;
}

/**
 * Get Campaigns from sticky.io or from the SFCC custom object
 * @param {Object} parameters - Parameters from a job context
 * @returns {Object} - Return campaignData object or true
 */
function getCampaigns(parameters) {
    allStickyioProducts = getAllStickyioMasterProducts();
    var existingJSON = getCampaignCustomObjectJSON();
    if (existingJSON && existingJSON.products && existingJSON.products.updateSFCC) { delete existingJSON.products.updateSFCC; }
    if (existingJSON && existingJSON.offers && existingJSON.offers.updateSFCC) { delete existingJSON.offers.updateSFCC; }
    if (existingJSON && existingJSON.terms && existingJSON.terms.updateSFCC) { delete existingJSON.terms.updateSFCC; }
    if (existingJSON && existingJSON.billingModels && existingJSON.billingModels.updateSFCC) { delete existingJSON.billingModels.updateSFCC; }
    var stickyioCampaigns = {};
    var campaignData = {};
    var campaignJSON = {};
    stickyioCampaigns = getCampaignCustomObject();
    if (!stickyioCampaigns || Object.keys(stickyioCampaigns).length === 0) { // if we don't have a default object, create one
        Transaction.wrap(function () {
            stickyioCampaigns = CustomObjectMgr.createCustomObject('stickyioCampaigns', 'campaigns');
        });
    }
    campaignData = getCampaignsFromStickyio(1, {});
    if (Object.keys(campaignData).length > 0) {
        var sampleProductID;
        campaignJSON.updateTime = new Date();
        if (allStickyioProducts) {
            campaignJSON.products = getAllStickyioVariantProducts(allStickyioProducts);
        }
        if ((existingJSON && existingJSON.products && !deepEqual(existingJSON.products, campaignJSON.products)) || (!existingJSON || !existingJSON.products)) {
            if (campaignJSON.products) { campaignJSON.products.updateSFCC = true; }
        }
        if (Object.keys(campaignJSON.products).length > 0) {
            sampleProductID = Object.keys(campaignJSON.products)[0];
        }
        var campaignOfferData = reshapeCampaignData(campaignData);
        // add additional condition/method to check that json object matches all product options data. if not, set updateSFCC to true
        campaignJSON.offers = campaignOfferData.offers;
        if ((existingJSON && existingJSON.offers && (!deepEqual(existingJSON.offers, campaignJSON.offers) || !validateStickySystemObjects('offers', sampleProductID, existingJSON.offers))) || (!existingJSON || !existingJSON.offers)) {
            if (campaignJSON.offers) { campaignJSON.offers.updateSFCC = true; }
        }
        campaignJSON.terms = campaignOfferData.terms;
        if ((existingJSON && existingJSON.terms && (!deepEqual(existingJSON.terms, campaignJSON.terms) || !validateStickySystemObjects('terms', sampleProductID, existingJSON.terms))) || (!existingJSON || !existingJSON.terms)) {
            if (campaignJSON.terms) { campaignJSON.terms.updateSFCC = true; }
        }
        campaignJSON.billingModels = getBillingModelsFromStickyio(1, {});
        if ((existingJSON && existingJSON.billingModels && (!deepEqual(existingJSON.billingModels, campaignJSON.billingModels) || !validateStickySystemObjects('billingModels', sampleProductID, existingJSON.billingModels))) || (!existingJSON || !existingJSON.billingModels)) {
            if (campaignJSON.billingModels) { campaignJSON.billingModels.updateSFCC = true; }
        }
        Transaction.wrap(function () {
            stickyioCampaigns.custom.jsonData = JSON.stringify(campaignJSON);
        });
    }
    validateAllProducts();
    if (parameters && parameters['Email Log'] && parameters['Email Address'] !== '') {
        var content = '';
        content = 'Raw Campaign Data:\n';
        content += JSON.stringify(campaignJSON, null, '\t');
        sendNotificationEmail(parameters['Email Address'].toString(), content, 'Campaign Update Log');
    }
    return true;
}

/**
 * Update sticky.io Offer with SFCC Products
 * @param {number} offerID - sticky.io Offer ID
 * @param {Object} offerData - offer products and billing models to sync
 * @returns {boolean} - boolean return
*/
function updateOffer(offerID, offerData) {
    if (offerData.products || offerData.billingModels) {
        var params = {};
        params.id = offerID;
        params.body = {};
        if (offerData.products && offerData.products.length > 0) { params.body.products = offerData.products.map(function (id) { return { id: id }; }); }
        if (offerData.billingModels && offerData.billingModels.length > 0) { params.body.billing_models = offerData.billingModels.map(function (id) { return { id: id }; }); }
        var stickyioResponse = stickyioAPI('stickyio.http.put.offers').call(params);
        if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
            return true;
        }
    }
    return false;
}

/**
 * Reset SFCC custom sticky.io attributes
 * @param {dw.catalog.Product} product - SFCC product
 * @param {boolean} persistStickyIDs - job param to not erase sticky.io PIDs
 * @returns {void}
*/
function resetProduct(product, persistStickyIDs) {
    var thisProduct = product;
    Transaction.wrap(function () {
        if (!persistStickyIDs) {
            thisProduct.custom.stickyioProductID = null; // int
            thisProduct.custom.stickyioVariationID = null; // int
        }
        var i;
        for (i = 1; i <= 3; i++) {
            delete thisProduct.custom['stickyioOffer' + i]; // enum of strings
            delete thisProduct.custom['stickyioBillingModels' + i]; // enum of strings
            delete thisProduct.custom['stickyioTerms' + i]; // enum of strings
            thisProduct.custom['stickyioOffer' + i] = null; // enum of strings
            thisProduct.custom['stickyioBillingModels' + i] = null; // enum of strings
            thisProduct.custom['stickyioTerms' + i] = null; // enum of strings
        }
        delete thisProduct.custom.stickyioVertical; // enum of strings
        thisProduct.custom.stickyioVertical = null; // enum of strings
        thisProduct.custom.stickyioReady = null; // boolean
        thisProduct.custom.stickyioBillingModelConsumerSelectable = null; // boolean
        thisProduct.custom.stickyioOneTimePurchase = null; // boolean
        thisProduct.custom.stickyioLastSync = null; // date + time
    });
}

/**
 * Get product attributes from sticky.io
 * @param {number} stickyioPID - sticky.io product ID
 * @returns {Object} - boolean result or API result
 */
function getAttributes(stickyioPID) {
    var params = {};
    params.id = stickyioPID;
    params.helper = 'attributes';
    var stickyioResponse = stickyioAPI('stickyio.http.get.products.attributes').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
        return stickyioResponse;
    }
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) === 'undefined') {
        return true; // this product doesn't have any attributes, but it's valid
    }
    return false; // this product failed being retrieved from sticky.io
}

/**
 * Delete a variant from sticky.io
 * @param {number} variantID - sticky.io variant ID
 * @param {Object} productID - sticky.io product ID
 * @returns {Object} - Result of the API call
 */
function deleteVariant(variantID, productID) {
    var params = {};
    params.id = productID;
    params.id2 = variantID;
    params.helper = 'variants';
    return stickyioAPI('stickyio.http.delete.products.variants').call(params);
}

/**
 * Update a variant in sticky.io
 * @param {dw.catalog.Product} variant - SFCC variant product
 * @returns {Object} - Result of the API call
 */
function updateStickyioVariant(variant) {
    var params = {};
    var body = {};
    params.id = variant.custom.stickyioProductID;
    params.id2 = variant.custom.stickyioVariationID;
    params.helper = 'variants';
    body.sku_num = variant.ID;
    body.price = variant.getPriceModel().getPrice().value ? variant.getPriceModel().getPrice().value.toFixed(2) : 0.01;
    params.body = body;
    return stickyioAPI('stickyio.http.put.products.variants').call(params);
}

/**
 * Update an order's custom fields in sticky.io
 * @param {string} orderNumber - sticky.io order number
 * @param {Object} customFields - array of custom field objects denoted by { token, value }
 * @returns {Object} - Result of the API call
 */
function updateStickyioCustomField(orderNumber, customFields) {
    var params = {};
    var body = {};
    var theseCustomFields = [];
    var i;
    for (i = 0; i < customFields.length; i++) {
        if (customFields[i].value) {
            theseCustomFields.push(customFields[i]);
        }
    }
    params.id = orderNumber;
    params.helper = 'custom_fields';
    body.custom_fields = theseCustomFields;
    params.body = body;
    return stickyioAPI('stickyio.http.put.orders.customfields').call(params);
}

/**
 * Void an order in sticky.io
 * @param {string} orderNumber - sticky.io order number
 * @returns {Object} - True or error
 */
function voidStickyioOrder(orderNumber) {
    var params = {};
    var body = {};
    body.order_id = orderNumber;
    params.body = body;
    var stickyioResponse = stickyioAPI('stickyio.http.post.order_void').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.response_code === '100') {
        return true;
    }
    return stickyioResponse.error;
}

/**
 * Running log of product updates in sticky.io
 * @param {string} productID - SFCC productID
 * @param {Object} data - sticky.io data to store
 * @returns {void}
*/
function productSyncLog(productID, data) {
    subscriptionProductsLog[productID] = data;
}

/**
 * Commit SFCC sticky.io custom attributes
 * @param {dw.catalog.Product} product - SFCC product
 * @param {Object} stickyioData - sticky.io product data
 * @param {Object} productAttributes - SFCC product attributes
 * @param {Object} masterProductID - SFCC product ID
 * @param {Object} productVariants - SFCC product variants
 * @param {number} iterator - Current position from callingfunction
 * @returns {void}
 */
function commitUpdateSFCCVariantAttributes(product, stickyioData, productAttributes, masterProductID, productVariants, iterator) {
    var thisStickyioData = stickyioData;
    var theseProductVariants = productVariants;
    var i = iterator;
    var j;
    Object.keys(thisStickyioData).forEach(function (variant) {
        var match = [];
        thisStickyioData[variant].attributes.forEach(function (stickyioAttribute) {
            for (j = 0; j < productAttributes.length; j++) {
                var thisAttribute = productAttributes[j];
                if (thisAttribute.attributeID.toLowerCase() === stickyioAttribute.attribute.name.toLowerCase() && product.getVariationModel().getVariationValue(theseProductVariants[i], thisAttribute).value.toLowerCase() === stickyioAttribute.attribute.option.name.toLowerCase()) { match.push(true); }
            }
        });
        if (match.length === thisStickyioData[variant].attributes.length) {
            // check to see if the thisStickyioData[variant] already has a VID & PI. if so, we don't need to update
            if (masterProductID !== theseProductVariants[i].custom.stickyioProductID || thisStickyioData[variant].id !== theseProductVariants[i].custom.stickyioVariationID || thisStickyioData[variant].sku_num !== theseProductVariants[i].ID || parseFloat(thisStickyioData[variant].price).toFixed(2) !== theseProductVariants[i].getPriceModel().getPrice().value.toFixed(2)) {
                try {
                    // update the SFCC variations with the sticky.io IDs, set the stickyioSubscriptionProduct attribute = true
                    Transaction.wrap(function () {
                        theseProductVariants[i].custom.stickyioLastSync = new Calendar().time; // set the last sync time to now
                        theseProductVariants[i].custom.stickyioSubscriptionActive = true;
                        theseProductVariants[i].custom.stickyioProductID = masterProductID;
                        theseProductVariants[i].custom.stickyioVariationID = parseInt(thisStickyioData[variant].id, 10);
                    });
                } catch (e) {
                    Logger.error('Error while setting sticky.io custom attributes for variant: ' + theseProductVariants[i].ID);
                    throw e;
                }
                updateStickyioVariant(theseProductVariants[i]); // update sticky.io with the correct SKU/pricing for this variant
                productSyncLog(theseProductVariants[i].ID, { stickyioPID: masterProductID, stickyioVID: parseInt(thisStickyioData[variant].id, 10) });
            }
            thisStickyioData[variant].valid = true; // set a flag so we know this sticky.io variant matches a SFCC product
        }
    });
}

/**
 * Update variant attributes in sticky.io and
 * set SFCC sticky.io custom attributes if updates are made
 * @param {dw.catalog.Product} product - SFCC product
 * @param {Object} stickyioData - sticky.io product data
 * @param {boolean} resetProducts - boolean flag to wipe data
 * @param {boolean} persistStickyIDs - boolean flag to keep sticky.io product IDs when resetProducts is true
 * @returns {boolean} - boolean result
 */
function updateSFCCVariantAttributes(product, stickyioData, resetProducts, persistStickyIDs) {
    var thisStickyioData = stickyioData;
    var productVariants = product.getVariants();
    var masterProductID = product.custom.stickyioProductID;
    var i;
    for (i = 0; i < productVariants.length; i++) {
        if (resetProducts) { resetProduct(productVariants[i], persistStickyIDs); }
        var pvm = productVariants[i].getVariationModel();
        var productAttributes = pvm.getProductVariationAttributes();
        commitUpdateSFCCVariantAttributes(product, thisStickyioData, productAttributes, masterProductID, productVariants, i);
    }
    // remove any extraneous variants created by sticky.io
    Object.keys(thisStickyioData).forEach(function (variant) {
        if (typeof (thisStickyioData[variant].valid) === 'undefined') {
            deleteVariant(thisStickyioData[variant].id, masterProductID);
        }
    });
    return true;
}

/**
 * Update SFCC product custom sticky.io attributes
 * @param {dw.catalog.Product} product - SFCC product
 * @param {Object} stickyioResponse - sticky.io API response from a product create/update call
 * @param {boolean} productChange - boolean flag to indicate if the product changed since last push to sticky.io
 * @param {boolean} newProduct - boolean flag to indicate if this is a new product
 * @param {number} vertical - sticky.io product vertical ID
 * @returns {boolean} - boolean result
 */
function updateSFCCProductAttributes(product, stickyioResponse, productChange, newProduct, vertical) {
    var thisProduct = product;
    if (stickyioResponse && !stickyioResponse.error && ((stickyioResponse.object.result.response_code === '100') || (stickyioResponse.object.result.response_code === '911' && productChange))) {
        try {
            Transaction.wrap(function () {
                if (newProduct) {
                    thisProduct.custom.stickyioProductID = parseInt(stickyioResponse.object.result.new_product_id, 10);  // update the local SFCC product custom attribute with the sticky.io product id
                    thisProduct.custom.stickyioCampaignID = 1; // this is a new product, so make sure to set its campaignID to the hard-coded site-wide campaign
                    if (vertical) { thisProduct.custom.stickyioVertical = '5'; } // if this parameter is present, no vertical was selected by the merchant, so we default to Clothing & Accessories
                }
                thisProduct.custom.stickyioLastSync = new Calendar().time; // set the last sync time to now
            });
        } catch (e) {
            Logger.error('Error while setting sticky.io custom attributes for PID: ' + thisProduct.ID + ': ' + JSON.stringify(e, null, 2));
            throw e;
        }
        productSyncLog(product.ID, { stickyioPID: thisProduct.custom.stickyioProductID });
    }
    return true;
}

/**
 * Add variant attributes to a product in sticky.io
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {Object} - Result of the API call
 */
function addVariantAttributes(product) {
    var params = {};
    params.id = product.custom.stickyioProductID;
    params.helper = 'attributes';
    params.body = {};
    params.body.auto_create_variants = true;
    params.body.attributes = [];
    var pvm = product.getVariationModel();
    var productAttributes = pvm.getProductVariationAttributes();
    var variants = [];
    var i;
    var j;
    for (i = 0; i < productAttributes.length; i++) {
        var thisAttribute = {};
        thisAttribute.name = productAttributes[i].attributeID;
        thisAttribute.options = [];
        var productAttributeValues = pvm.getAllValues(productAttributes[i]);
        for (j = 0; j < productAttributeValues.length; j++) {
            thisAttribute.options.push(productAttributeValues[j].value);
        }
        variants.push(thisAttribute);
    }
    params.body.attributes = variants;
    return stickyioAPI('stickyio.http.post.products.attributes').call(params);
}

/**
 * Compare SFCC variation attributes with what's available
 * in sticky.io
 * @param {dw.catalog.Product} product - SFCC product
 * @param {Object} stickyioData - sticky.io product data
 * @returns {boolean} - boolean result
 */
function compareAttributes(product, stickyioData) {
    var pvm = product.getVariationModel();
    var productAttributes = pvm.getProductVariationAttributes();
    var i;
    var j;
    Object.keys(stickyioData).forEach(function (attribute) {
        var match = [];
        stickyioData[attribute].options.forEach(function (stickyioAttribute) {
            for (i = 0; i < productAttributes.length; i++) {
                var thisAttribute = productAttributes[i];
                var productAttributeValues = pvm.getAllValues(thisAttribute);
                for (j = 0; j < productAttributeValues.length; j++) {
                    if (thisAttribute.attributeID.toLowerCase() === stickyioData[attribute].name.toLowerCase() && productAttributeValues[j].value.toLowerCase() === stickyioAttribute.name.toLowerCase()) { match.push(true); }
                }
            }
        });
        if (match.length !== stickyioData[attribute].options.length) { // the attributes in sticky.io do not match the possibilites in SFCC
            return false;
        }
        return true;
    });
    return true;
}

/**
 * Update the existing SFCC product custom stickyioProductID attribute with the existing matching sticky.io product id
 * @param {dw.catalog.Product} product - SFCC product
 * @param {number} productID - sticky.io product ID
 * @returns {void}
 */
function updateProductID(product, productID) {
    var thisProduct = product;
    Transaction.wrap(function () { thisProduct.custom.stickyioProductID = productID; });
}

/**
 * Update the custom lastSync attribute of this product
 * @param {dw.catalog.Product} product - SFCC products
 * @returns {void}
 */
function updateLastSync(product) {
    var thisProduct = product;
    Transaction.wrap(function () { thisProduct.custom.stickyioLastSync = new Date(new Date().getTime() + 60000); }); // pad update with a minute because of SFCC lag
}

/**
 * Create a new product or update an existing SFCC product in sticky.io
 * @param {dw.catalog.Product} product - SFCC product
 * @param {boolean} resetProductVariants - boolean flag to reset the product's variant's custom sticky.io attributes
 * @param {boolean} persistStickyIDs - boolean flag to persist product's custom sticky.io product IDs when resetProducts is true
 * @returns {void}
 */
function createOrUpdateProduct(product, resetProductVariants, persistStickyIDs) {
    var newProduct = true;
    var existantProduct = getCorrespondingPIDandName(product.ID, 0); // check to see if this product exists in sticky.io
    if (existantProduct) { // it exists
        if (persistStickyIDs && product.custom.stickyioProductID !== existantProduct.stickyioProductID) {
            updateProductID(product, existantProduct.stickyioProductID);
            newProduct = false;
        }
    }
    var productChange = false;
    var stickyioData = {};
    if (product.isVariant() && product.masterProduct.custom.stickyioSubscriptionActive === true) { stickyioData.stickyioResponse = 'skip'; } // this is a variant bound to a subscribe-able master, so don't create it as a stand-alone product
    var lastModified = new Calendar(product.getLastModified()).getTime().getTime();
    var storedLastModified = product.custom.stickyioLastSync ? product.custom.stickyioLastSync.getTime() : 0;
    if (lastModified > storedLastModified) { productChange = true; }
    var apiCall = 'stickyio.http.post.product_create';
    var params = {};
    var body = {};
    body.product_name = product.name;
    body.category_id = 1;
    body.vertical_id = parseInt(product.custom.stickyioVertical !== null ? product.custom.stickyioVertical.getValue() : 5, 10); // default to Clothing & Apparel
    body.product_sku = product.ID;
    body.product_price = product.getPriceModel().getPrice().value ? product.getPriceModel().getPrice().value.toFixed(2) : 0.01;
    body.product_description = product.shortDescription.markup;
    body.product_max_quantity = 100;
    body.taxable = true;
    body.shippable = true;
    if (productChange && product.custom.stickyioProductID !== null && (product.isMaster() || product.isProduct())) {
        if (!newProduct) { // update the product in sticky.io
            apiCall = 'stickyio.http.post.product_update';
            params.body = {};
            params.body.product_id = {};
            params.body.product_id[product.custom.stickyioProductID] = body;
            stickyioData = { stickyioResponse: stickyioAPI(apiCall).call(params), productChange: productChange, newProduct: newProduct };
        }
    }
    if (product.custom.stickyioProductID === null) { // create the product in sticky.io
        params.body = body;
        stickyioData = { stickyioResponse: stickyioAPI(apiCall).call(params), productChange: productChange, newProduct: newProduct };
    } else { stickyioData = { stickyioResponse: false, productChange: productChange, newProduct: newProduct }; }
    if (stickyioData.stickyioResponse !== false && stickyioData.stickyioResponse !== 'skip') {
        updateSFCCProductAttributes(product, stickyioData.stickyioResponse, stickyioData.productChange, stickyioData.newProduct, (product.custom.stickyioVertical === null));
    }
    if (product.isMaster()) {
        var stickyioResponse = getAttributes(product.custom.stickyioProductID);
        if (stickyioResponse || (typeof (stickyioResponse) === 'object' && stickyioResponse.object.result.status === 'SUCCESS')) {
            if (stickyioResponse === true) { // this is a new master product with no variants/attributes yet
                stickyioResponse = addVariantAttributes(product);
                if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS') {
                    stickyioResponse = getVariants(product.custom.stickyioProductID, true);
                    if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS') {
                        updateSFCCVariantAttributes(product, stickyioResponse.object.result.data, resetProductVariants, persistStickyIDs);
                    }
                }
            } else if (!compareAttributes(product, stickyioResponse.object.result.data)) { // this is an existing master product, so let's make sure things match
                stickyioResponse = addVariantAttributes(product); // SFCC variant attributes and sticky.io attributes don't match
            }
            // let's make sure prices and SKUs and such match
            stickyioResponse = getVariants(product.custom.stickyioProductID, true);
            if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS') {
                updateSFCCVariantAttributes(product, stickyioResponse.object.result.data, resetProductVariants, persistStickyIDs);
            }
        }
    }
    if (productChange) { updateLastSync(product); }
}

/** Get the active billing models of a SFCC Product of a given offer
 * @param {dw.catalog.Product} product - SFCC Product
 * @param {number} offer - offer number
 * @returns {Object} - Array of active billing model IDs
 */
function getActiveBillingModels(product, offer) {
    var stickyioproductAvailableBillingModels = [];
    var i;
    var j;
    if (product) { // we don't want to check for the bogus straightSale product
        // check all three of our possible offer slots to determine which one is selected as the given offer, then pull all billing models for that offer
        for (i = 1; i < 3; i++) {
            if (product.custom['stickyioOffer' + i].value !== null && product.custom['stickyioOffer' + i].value.toString() === offer.toString()) {
                for (j = 0; j < product.custom['stickyioBillingModels' + i].length; j++) {
                    stickyioproductAvailableBillingModels.push(parseInt(product.custom['stickyioBillingModels' + i][j].value, 10).toString());
                }
            }
        }
    }
    return stickyioproductAvailableBillingModels;
}

/**
 * Turn off the stickyioSubscriptionActive custom attribute
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {void}
 */
function turnOffSubscription(product) {
    var thisProduct = product;
    Transaction.wrap(function () { thisProduct.custom.stickyioSubscriptionActive = null; });
}

/**
 * Update a not-yet-subscribable productSet product with its parent's subscription options, if it doesn't aleady have its own
 * @param {dw.catalog.Product} productSet - SFCC productSet
 * @param {dw.catalog.Product} productSetProduct - SFCC product
 * @returns {void}
 */
function setupProductSetProduct(productSet, productSetProduct) {
    var thisProductSetProduct = productSetProduct;
    Transaction.begin();
    if (!thisProductSetProduct.custom.stickyioSubscriptionActive) { thisProductSetProduct.custom.stickyioSubscriptionActive = true; }
    if (thisProductSetProduct.custom.stickyioBillingModelConsumerSelectable === null && productSet.custom.stickyioBillingModelConsumerSelectable !== null) { thisProductSetProduct.custom.stickyioBillingModelConsumerSelectable = productSet.custom.stickyioBillingModelConsumerSelectable; }
    if (thisProductSetProduct.custom.stickyioOneTimePurchase === null && productSet.custom.stickyioOneTimePurchase !== null) { thisProductSetProduct.custom.stickyioOneTimePurchase = productSet.custom.stickyioOneTimePurchase; }
    var i;
    for (i = 1; i < 3; i++) {
        if (thisProductSetProduct.custom['stickyioOffer' + i].value === null && productSet.custom['stickyioOffer' + i].value !== null) { thisProductSetProduct.custom['stickyioOffer' + i] = productSet.custom['stickyioOffer' + i].value; }
        if (thisProductSetProduct.custom['stickyioBillingModels' + i].length === 0 && productSet.custom['stickyioBillingModels' + i].length > 0) { thisProductSetProduct.custom['stickyioBillingModels' + i] = getActiveBillingModels(productSet, i); }
    }
    Transaction.commit();
}

/**
 * Build the global offerProducts array
 * @param {Object} localAllStickyioProducts - Lite data of All sticky.io products
 * @returns {Object} - offerProducts
 */
function buildOfferSyncData(localAllStickyioProducts) {
    var stickyioCampaigns = getCampaignCustomObjectJSON(); // get our latest campaignJSON
    var offerSyncData = {};
    var thisOfferID;
    var thisBillingModel;
    var i;
    var j;
    Object.keys(localAllStickyioProducts).forEach(function (productID) {
        var product = ProductMgr.getProduct(productID);
        if (product && product.custom.stickyioProductID !== null) {
            for (i = 1; i <= 3; i++) {
                var thisOfferIDSetID = i;
                var thisOfferSet = 'stickyioOffer' + thisOfferIDSetID;
                if (product.custom[thisOfferSet].value !== null && product.custom[thisOfferSet].value !== '0') {
                    thisOfferID = product.custom[thisOfferSet].value;
                    if (!offerSyncData[thisOfferID]) {
                        offerSyncData[thisOfferID] = { products: [] };
                    }
                    if (offerSyncData[thisOfferID].products.indexOf(product.custom.stickyioProductID) === -1) {
                        offerSyncData[thisOfferID].products.push(product.custom.stickyioProductID);
                    }
                }
            }
        }
    });
    if (stickyioCampaigns && stickyioCampaigns.billingModels && Object.keys(stickyioCampaigns.billingModels).length > 0) {
        for (i = 0; i < Object.keys(offerSyncData).length; i++) {
            thisOfferID = Object.keys(offerSyncData)[i];
            if (!offerSyncData[thisOfferID].billingModels) {
                offerSyncData[thisOfferID].billingModels = Object.keys(stickyioCampaigns.billingModels);
                if (stickyioCampaigns && stickyioCampaigns.offers && stickyioCampaigns.offers[thisOfferID] && stickyioCampaigns.offers[thisOfferID].is_prepaid) { // check to see if this offer supports straight sale (any offer that's not of type prepaid)
                    offerSyncData[thisOfferID].billingModels.splice(offerSyncData[thisOfferID].billingModels.indexOf('2'), 1); // remove the straight sale model
                }
            }
            for (j = offerSyncData[thisOfferID].billingModels.length; j > 0; j--) {
                thisBillingModel = offerSyncData[thisOfferID].billingModels[j];
                if (thisBillingModel === 'updateSFCC') { offerSyncData[thisOfferID].billingModels.splice(j); }
            }
        }
    }
    if (stickyioCampaigns && stickyioCampaigns.offers && Object.keys(stickyioCampaigns.offers).length > 0) {
        for (i = 0; i < Object.keys(stickyioCampaigns.offers).length; i++) {
            thisOfferID = Object.keys(stickyioCampaigns.offers)[i];
            if (thisOfferID !== 'updateSFCC') {
                if (!offerSyncData[thisOfferID]) { // no products were bound to this offer, but lets update its billing models anyway
                    offerSyncData[thisOfferID] = { billingModels: Object.keys(stickyioCampaigns.billingModels) };
                    if (stickyioCampaigns.offers[thisOfferID].is_prepaid) { // check to see if this offer supports straight sale (any offer that's not of type prepaid)
                        offerSyncData[thisOfferID].billingModels.splice(offerSyncData[thisOfferID].billingModels.indexOf('2'), 1); // remove the straight sale model
                    }
                }
                for (j = offerSyncData[thisOfferID].billingModels.length; j > 0; j--) {
                    thisBillingModel = offerSyncData[thisOfferID].billingModels[j];
                    if (thisBillingModel === 'updateSFCC') { offerSyncData[thisOfferID].billingModels.splice(j); }
                }
            }
        }
    }
    return offerSyncData;
}

/**
 * Make sure all products and billing models are bound to their offers and push results to the global offerProductsLog
 * @param {Object} localAllStickyioProducts - Lite data of All sticky.io products
 * @returns {void}
 */
function syncOffers(localAllStickyioProducts) {
    if (localAllStickyioProducts === null) { // this should never happen
        allStickyioProducts = getAllStickyioMasterProducts();
    }
    if (allStickyioProducts) {
        var offerSyncData = buildOfferSyncData(allStickyioProducts); // get all existing offerIDs from sticky.io
        var i;
        for (i = 0; i < Object.keys(offerSyncData).length; i++) {
            if (updateOffer(Object.keys(offerSyncData)[i], offerSyncData[Object.keys(offerSyncData)[i]])) {
                offerProductsLog.push('Synced Offer ' + Object.keys(offerSyncData)[i]);
            } else {
                offerProductsLog.push('Error syncing Offer ' + Object.keys(offerSyncData)[i]);
            }
        }
    }
}

/**
 * Sync products between SFCC and sticky.io
 * @param {dw.catalog.Product} product - an online SFCC product
 * @param {Object} localAllStickyioProducts - Lite data of All sticky.io products
 * @param {boolean} reset - Job parameter to reset all custom sticky.io attributes
 * @param {boolean} persist - Job parameter to persist sticky.io product IDs in the face of a rest
 * @param {boolean} recursed - Flag to know if this is a recursion call
 * @returns {void}
 */
function syncProduct(product, localAllStickyioProducts, reset, persist, recursed) {
    var thisProduct = product;
    var productSetProducts;
    var thisReset = reset;
    var thisPersist = persist;
    if (!recursed && thisReset) {
        var stickyioCampaigns = getCampaignCustomObject();
        if (!stickyioCampaigns || Object.keys(stickyioCampaigns).length === 0) { // if we don't have a default object, create one
            Transaction.wrap(function () {
                stickyioCampaigns = CustomObjectMgr.createCustomObject('stickyioCampaigns', 'campaigns');
            });
        }
        Transaction.wrap(function () {
            stickyioCampaigns.custom.jsonData = null; // make sure the campaign data is empty
        });
    }

    if (localAllStickyioProducts === null) { // this should never happen
        allStickyioProducts = getAllStickyioMasterProducts();
    } else { allStickyioProducts = localAllStickyioProducts; }

    if (thisProduct && thisProduct.online && thisProduct.custom.stickyioSubscriptionActive === true && !subscriptionProductsLog[thisProduct.ID]) {
        // Prevent variants that are marked active making it to sticky.io. Only Products, Master Products, and Product Sets can be marked as subscribe-able
        if (thisProduct.isVariant() && thisProduct.masterProduct.getVariants().length > 1) { // >1 because sometimes there are masters with only one variant... which is weird, but they should be allowed and will be treated as a 'product'
            turnOffSubscription(thisProduct);
        } else {
            if (thisReset === true) { resetProduct(thisProduct, thisPersist); }
            if (thisProduct.isProductSet()) { // if this is a product set, handle the individual products
                productSetProducts = thisProduct.getProductSetProducts();
                var i;
                for (i = 0; i < productSetProducts.length; i++) {
                    setupProductSetProduct(thisProduct, productSetProducts[i]);
                    syncProduct(productSetProducts[i], allStickyioProducts, thisReset, thisPersist, true);
                }
            } else {
                if (recursed) { thisReset = false; } // don't reset the product and its possible variants a second time
                createOrUpdateProduct(thisProduct, thisReset, thisPersist);
            }
        }
    }
}

/**
 * Method to check if an order/basket has sticky.io subscription
 * products in it, and if so, pull a set of IDs to be used in subsequent
 * sticky.io API calls
 * @param {dw.order.Order} order - SFCC product
 * @returns {Object} - boolean return or Object with sticky.io IDs
*/
function hasSubscriptionProducts(order) {
    var BasketMgr = require('dw/order/BasketMgr');
    var plis;
    var i;
    if (!order) {
        var basket = BasketMgr.getCurrentOrNewBasket();
        plis = basket.getAllProductLineItems();
    } else { plis = order.getAllProductLineItems(); }
    var containsSubscriptionProducts = false;
    if (!plis) { return false; }
    for (i = 0; i < plis.length; i++) {
        containsSubscriptionProducts = plis[i].custom.stickyioOfferID !== null;
        if (containsSubscriptionProducts) {
            // we need PID and CID later for the authorization_payment API call, so return the first one we find to save us time later
            return {
                stickyioPID: plis[i].custom.stickyioProductID,
                stickyioCID: plis[i].custom.stickyioCampaignID,
                stickyioOID: plis[i].custom.stickyioOfferID
            };
        }
    }
    return false;
}

/**
 * Create the bogus straight sale product in sticky.io and store its product ID in a SFCC custom preference
 * @returns {void}
*/
function createStraightSaleProduct() {
    var reset = false;
    var stickyioResponse;
    var params = {};
    var body = {};
    var existingStraightSaleID = Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleProductID');
    if (existingStraightSaleID) { // check to see if this already exists at sticky.io and, if so and it matches our straight sale sku, just use it
        body.product_id = existingStraightSaleID;
        params.body = body;
        stickyioResponse = stickyioAPI('stickyio.http.post.product_index').call(params);
        if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.response_code === '100')) {
            if (stickyioResponse.object.result.products[existingStraightSaleID].product_sku !== 'stickyioStraightSale') { // this stickyioProductID we have stored doesn't match the straightSale product
                reset = true; // reset it
            }
        } else { reset = true; }
    }
    if (reset || !existingStraightSaleID) {
        body.product_name = 'stickyioStraightSale';
        body.category_id = 1;
        body.product_sku = 'stickyioStraightSale';
        body.product_price = 0.01;
        body.product_description = 'sticky.io -> SFCC Straight Sale system-created product';
        body.product_max_quantity = 1;
        body.taxable = true;
        body.shippable = false;
        params.body = body;
        stickyioResponse = stickyioAPI('stickyio.http.post.product_create').call(params);
        if (stickyioResponse && !stickyioResponse.error && (stickyioResponse.object.result.response_code === '100' && stickyioResponse.object.result.new_product_id)) {
            try {
                Transaction.wrap(function () { Site.getCurrent().setCustomPreferenceValue('stickyioStraightSaleProductID', parseInt(stickyioResponse.object.result.new_product_id, 10)); });
            } catch (e) {
                Logger.error('Error while setting stickyioStraightSaleProductID preference');
                throw e;
            }
        }
    }
}

/**
 * Get billing model details for sticky.io orders and append all available Billing Models to the order object's subscription product(s) based on the purchased offer id
 * @param {Object} orders - Object of sticky.io orders
 * @param {boolean} activeBillingModels - boolean flag to only return active billing models according to the current SFCC product
 * @returns {Object} - Returns sticky.io order object with appended details
 */
function getOrderBillingModels(orders, activeBillingModels) {
    var i;
    var j;
    var k;
    var theseOrders = orders;
    for (i = 0; i < Object.keys(theseOrders.orderData).length; i++) {
        var thisStickyioOrder = theseOrders.orderData[Object.keys(theseOrders.orderData)[i]];
        for (j = 0; j < thisStickyioOrder.products.length; j++) {
            var thisStickyioOrderProduct = thisStickyioOrder.products[j];
            var productActiveBillingModels = getActiveBillingModels(ProductMgr.getProduct(thisStickyioOrderProduct.sku), thisStickyioOrderProduct.offer.id);
            var billingModels = [];
            var params = {};
            params.id = thisStickyioOrderProduct.subscription_id;
            params.helper = 'billing_models';
            var stickyioResponse = stickyioAPI('stickyio.http.get.subscriptions.billing_models').call(params);
            if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
                for (k = 0; k < stickyioResponse.object.result.data.length; k++) {
                    var thisBillingModel = stickyioResponse.object.result.data[k];
                    if (activeBillingModels && productActiveBillingModels.length > 0) { // only allow billing models that are allowed by the product currently
                        if (productActiveBillingModels.indexOf(thisBillingModel.id.toString()) !== -1 && thisBillingModel.id !== 2) { // always exclude Straight Sale
                            billingModels.push(stickyioResponse.object.result.data[k]);
                        }
                    } else if (thisBillingModel.id !== 2) { // include all billing models, excluding Straight Sale billing model
                        billingModels.push(stickyioResponse.object.result.data[k]);
                    }
                }
                if (billingModels.length > 0) {
                    theseOrders.orderData[Object.keys(theseOrders.orderData)[i]].products[j].billing_models = billingModels;
                }
            }
        }
    }
    return theseOrders;
}

/**
 * Get orders from sticky.io
 * @param {Array} orderNumbers - Array of sticky.io order numbers
 * @param {boolean} includeBillingModels - boolean to include billing models
 * @param {boolean} activeBillingModels - boolean flag to only return active billing models according to the current SFCC product
 * @returns {Object} - Return false or the orders from sticky.io
 */
function getOrders(orderNumbers, includeBillingModels, activeBillingModels) {
    var returnData = {};
    var orders = {};
    orders.orderData = {};
    var params = {};
    var body = {};
    body.order_id = orderNumbers;
    params.body = body;
    var stickyioResponse = stickyioAPI('stickyio.http.post.order_view').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.response_code === '100') {
        if (typeof (stickyioResponse.object.result.data) === 'undefined') { // single order return
            orders.orderData[stickyioResponse.object.result.order_id] = stickyioResponse.object.result;
        } else { // multi order return
            orders.orderData = stickyioResponse.object.result.data;
        }
        if (includeBillingModels) {
            returnData = getOrderBillingModels(orders, activeBillingModels);
        } else { returnData = orders; }
        return returnData;
    }
    return false;
}

/**
 * Update SFCC order with tracking number provided by sticky.io
 * @param {dw.order.Order} order - SFCC order
 * @param {string} shipmentID - SFCC order shipment ID
 * @param {string} trackingNumber - sticky.io provided tracking number
 * @returns {boolean} - boolean result
 */
function updateSFCCShipping(order, shipmentID, trackingNumber) {
    try {
        Transaction.wrap(function () {
            order.getShipment(shipmentID).setTrackingNumber(trackingNumber);
            order.getShipment(shipmentID).setShippingStatus(Shipment.SHIPPING_STATUS_SHIPPED);
        });
    } catch (e) {
        Logger.error('Error setting shipping information for SFCC order: ' + order.orderNo + ': ' + e);
        return false;
    }
    return true;
}

/**
 * Update sticky.io order with tracking number
 * @param {string} stickyioOrderNumber - sticky.io order number
 * @param {string} trackingNumber - SFCC-provided tracking number
 * @returns {boolean} - boolean result
 */
function updateStickyioShipping(stickyioOrderNumber, trackingNumber) {
    var params = {};
    var body = {};
    body.order_id = {};
    var orderData = {};
    orderData.tracking_number = trackingNumber;
    body.order_id[stickyioOrderNumber] = orderData;
    params.body = body;
    var stickyioResponse = stickyioAPI('stickyio.http.post.order_update').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.response_code === '100') {
        return true;
    }
    return false;
}

/**
 * Update this order shipping status
 * @param {string} orderNo - SFCC order number
 * @param {string} orderToken - SFCC order token
 * @returns {boolean} - boolean result
 */
function orderShippingUpdate(orderNo, orderToken) { // loop through all order shipments and see if they're shipped or not, then update the order shipping status
    var order = OrderMgr.getOrder(orderNo, orderToken);
    var shipments = order.getShipments();
    var shipped = false;
    var i;
    for (i = 0; i < shipments.length; i++) {
        if (shipments[i].getShippingStatus() === Shipment.SHIPPING_STATUS_SHIPPED) {
            shipped = true;
            try {
                Transaction.wrap(function () {
                    order.setShippingStatus(Order.SHIPPING_STATUS_PARTSHIPPED);
                });
            } catch (e) {
                Logger.error('Error setting shipping status information for SFCC order: ' + order.orderNo + ': ' + e);
                return false;
            }
        }
    }
    if (shipped) { // all shipments have shipped!
        try {
            Transaction.wrap(function () {
                order.setShippingStatus(Order.SHIPPING_STATUS_SHIPPED);
            });
        } catch (e) {
            Logger.error('Error setting shipping status information for SFCC order: ' + order.orderNo + ': ' + e);
            return false;
        }
    }
    return true;
}

/**
 * Update this shipment to be compvare
 * @param {dw.order.Shipment} shipment - Order shipment tied to this sticky.io order
 * @param {string} orderNo - SFCC order number
 * @returns {boolean} - boolean result
 */
function shipmentUpdate(shipment, orderNo) {
    var thisShipment = shipment;
    try {
        Transaction.wrap(function () {
            thisShipment.custom.stickyioOrderUpdated = true;
        });
    } catch (e) {
        Logger.error('Error updating "stickyioOrderUpdated" for SFCC order: ' + orderNo + ': ' + e);
        return false;
    }
    return true;
}

/**
 * Commit the transaction to update the PLI details from sticky.io
 * @param {Object} product - sticky.io product data for an order
 * @param {dw.order.ProductLineItem} pli - Shipment product line item
 * @returns {Object} - Updated billing model details
 */
function commitOrderDetails(product, pli) {
    var billingModel = {};
    var thisPLI = pli;
    Transaction.wrap(function () {
        // detect if this billingmodel has terms?
        if (product.billing_model.id !== thisPLI.custom.stickyioBillingModelID) {
            thisPLI.custom.stickyioBillingModelID = Number(product.billing_model.id);
            billingModel.stickyioBillingModelID = Number(product.billing_model.id);
        }
        if (product.billing_model.name !== thisPLI.custom.stickyioBillingModelDetails) {
            thisPLI.custom.stickyioBillingModelDetails = product.billing_model.name;
            billingModel.stickyioBillingModelDetails = product.billing_model.name;
        }
    });
    return billingModel;
}

/**
 * Update the SFCC order's shipment(s) with the lastest sticky.io information
 * as it's possible a CSR has changed the billing model for a customer
 * and return an update orderView object
 * @param {Object} orderView - The existing orderView object
 * @returns {Object} - Updated orderView object
 */
function updateSubscriptionDetails(orderView) {
    var thisOrderView = orderView;
    var orderShipments = orderView.order.getShipments();
    var i;
    var j;
    var k;
    for (i = 0; i < orderShipments.length; i++) {
        var thisShipment = orderShipments[i];
        if (thisShipment.custom.stickyioOrderNo) {
            var stickyioOrderNo = thisShipment.custom.stickyioOrderNo;
            var stickyioOrderData = getOrders([stickyioOrderNo], false, false);
            if (stickyioOrderData) {
                var thisStickyioOrder = stickyioOrderData.data[Object.keys(stickyioOrderData.data)[0]];
                for (j = 0; j < thisShipment.productLineItems.length; j++) {
                    var thisPLI = thisShipment.productLineItems[j];
                    if (thisPLI.custom.stickyioSubscriptionID) {
                        for (k = 0; k < thisStickyioOrder.products.length; k++) {
                            var thisStickyioProduct = thisStickyioOrder.products[k];
                            if (thisStickyioProduct.subscription_id === thisPLI.custom.stickyioSubscriptionID) {
                                var billingModel = commitOrderDetails(thisStickyioProduct, thisPLI);
                                thisPLI.stickyioBillingModelID = billingModel.stickyioBillingModelID;
                                thisPLI.stickyioBillingModelDetails = billingModel.stickyioBillingModelDetails;
                            }
                        }
                    }
                }
            }
        }
    }
    return thisOrderView;
}

/**
 * Get subscription data from sticky.io and retrieve
 * management possibilities to turn off/on consumer control
 * @param {string} stickyioOrderNumber - sticky.io order number
 * @param {string} subscriptionID - sticky.io subscriptionID
 * @returns {Object} - Updated orderView object
 */
function getSubscriptionData(stickyioOrderNumber, subscriptionID, billingModels) {
    var i;
    var j;
    var stickyioOrderData = {};
    stickyioOrderData.stickyioOrderData = getOrders([stickyioOrderNumber], true, true).orderData;
    for (i = 0; i < Object.keys(stickyioOrderData.stickyioOrderData).length; i++) {
        var thisOrder = Object.keys(stickyioOrderData.stickyioOrderData)[i];
        for (j = 0; j < stickyioOrderData.stickyioOrderData[thisOrder].products.length; j++) {
            var thisProduct = stickyioOrderData.stickyioOrderData[thisOrder].products[j];
            if (thisProduct.subscription_id === subscriptionID) {
                stickyioOrderData.stickyioBillingModelID = thisProduct.billing_model.id;
                stickyioOrderData.stickyioBillingModelDetails = thisProduct.billing_model.name;
                stickyioOrderData.offerType = thisProduct.prepaid ? 'prepaid' : 'standard';
                stickyioOrderData.is_recurring = !!+thisProduct.is_recurring;
                stickyioOrderData.on_hold = !!+thisProduct.on_hold;
                if (thisProduct.hold_date !== '') {
                    stickyioOrderData.hold_date = thisProduct.hold_date;
                    stickyioOrderData.recurring_date = Resource.msg('label.subscriptionmanagement.on_hold', 'stickyio', null) + ' ' + stickyioOrderData.hold_date;
                } else { 
                    var billingModel;
                    if (billingModels) {
                        billingModel = getBillingModelFromModels(thisProduct.billing_model.id, billingModels);                      
                    }
                    stickyioOrderData.recurring_date = getNextDeliveryDate(stickyioOrderData.stickyioOrderData[thisOrder], thisProduct, thisProduct.recurring_date, billingModel); 
                }
                stickyioOrderData.billingModels = thisProduct.billing_models;
                break;
            }
        }
    }

    stickyioOrderData.stickyioAllowRecurring = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowRecurringDate');
    stickyioOrderData.stickyioAllowUpdateBillingModel = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowUpdateBillingModel');

    stickyioOrderData.stickyioAllowSubManSelect = true;
    stickyioOrderData.stickyioAllowSubManStartOptions = true;
    stickyioOrderData.stickyioAllowSubManPauseOptions = true;

    stickyioOrderData.stickyioAllowReset = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowReset');
    stickyioOrderData.stickyioAllowBillNow = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowBillNow');
    stickyioOrderData.stickyioAllowPause = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowPause');
    stickyioOrderData.stickyioAllowTerminateNext = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowTerminateNext');

    if (stickyioOrderData.stickyioAllowReset !== true
        && stickyioOrderData.stickyioAllowBillNow !== true
    ) { stickyioOrderData.stickyioAllowSubManStartOptions = false; }
    if (stickyioOrderData.stickyioAllowPause !== true
        && stickyioOrderData.stickyioAllowTerminateNext !== true
    ) { stickyioOrderData.stickyioAllowSubManPauseOptions = false; }
    if (!stickyioOrderData.stickyioAllowSubManStartOptions && !stickyioOrderData.stickyioAllowSubManPauseOptions) { stickyioOrderData.stickyioAllowSubManSelect = false; }
    return stickyioOrderData;
}

/**
 * Update the sticky.io subscription billing model
 * @param {string} subscriptionID - sticky.io subscription ID
 * @param {number} bmID - The new billingModelID
 * @returns {Object} - result of the call
 */
function subManUpdateBillingModel(subscriptionID, bmID) {
    var params = {};
    var body = {};
    body.billing_model_id = bmID;
    params.body = body;
    params.id = subscriptionID;
    params.helper = 'billing_model';
    var stickyioResponse = stickyioAPI('stickyio.http.put.subscriptions.billing_model').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.billing_model', 'stickyio', null) };
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Update the sticky.io subscription recurring date
 * @param {string} subscriptionID - sticky.io subscription ID
 * @param {string} date - New recurring date (yyyy-mm-dd)
 * @returns {Object} - result of the call
 */
function subManUpdateRecurringDate(subscriptionID, date) {
    var params = {};
    var body = {};
    body.recur_at = date;
    params.body = body;
    params.id = subscriptionID;
    params.helper = 'recur_at';
    var stickyioResponse = stickyioAPI('stickyio.http.put.subscriptions.recur_at').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.recur_at', 'stickyio', null) };
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Pause the sticky.io subscription
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManPause(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    params.helper = 'stop';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.stop').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.pause', 'stickyio', null) };
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Terminate the sticky.io subscription after the next re-bill
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManTerminateNext(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    params.helper = 'terminate_next';
    var stickyioResponse = stickyioAPI('stickyio.http.put.subscriptions.terminate_next').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.terminate_next', 'stickyio', null) };
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Update the SFCC custom sticky.io orderID attribute
 * @param {Object} shipment - SFCC shipment
 * @param {string} orderID - sticky.io order ID
 * @returns {void}
 */
function updateOrderID(shipment, orderID) {
    // do we actually need to do this?
    var thisShipment = shipment;
    Transaction.wrap(function () { thisShipment.custom.stickyioOrderNo = orderID; });
}

/**
 * Reset the sticky.io subscription to its original parameters
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManReset(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    params.helper = 'reset';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.reset').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.reset', 'stickyio', null) };
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Bill the sticky.io subscription now
 * @param {string} orderNo - SFCC order number
 * @param {string} orderToken - SFCC order token
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManBillNow(orderNo, orderToken, subscriptionID) {
    var i;
    var j;
    var params = {};
    params.id = subscriptionID;
    params.helper = 'bill_now';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.bill_now').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        // update the original SFCC order's lineitem sticky.io order ID
        var newOrderID = stickyioResponse.object.result.data.orderId;
        var order = OrderMgr.getOrder(orderNo, orderToken);
        var orderShipments = order.getShipments();
        for (i = 0; i < orderShipments.length; i++) {
            var thisShipment = orderShipments[i];
            for (j = 0; j < thisShipment.productLineItems.length; j++) {
                var thisPLI = thisShipment.productLineItems[j];
                if (thisPLI.custom.stickyioSubscriptionID === subscriptionID) {
                    updateOrderID(thisShipment, newOrderID);
                    return { message: Resource.msg('label.subscriptionmanagement.response.bill_now', 'stickyio', null) };
                }
            }
        }
    }
    var message = Resource.msg('label.subscriptionmanagement.response.genericerror', 'stickyio', null);
    if (stickyioResponse && stickyioResponse.errorMessage) { message = JSON.parse(stickyioResponse.errorMessage); }
    return { error: true, message: message };
}

/**
 * Make the change the subscription as indicated by the user
 * @param {string} orderNo - SFCC order number
 * @param {string} orderToken - SFCC order token
 * @param {string} subscriptionID - sticky.io subscription ID
 * @param {string} action - Subscription management action
 * @param {number} bmID - Billing Model ID to change to
 * @param {string} date - Date to change to
 * @returns {Object} - result of the change
 */
function stickyioSubMan(orderNo, orderToken, subscriptionID, action, bmID, date) {
    if (!action || !subscriptionID) { return false; }
    if (action === 'billing_model') {
        if (!bmID) { return false; }
        return subManUpdateBillingModel(subscriptionID, bmID);
    }
    if (action === 'recur_at') {
        if (!date) { return false; }
        return subManUpdateRecurringDate(subscriptionID, date);
    }
    if (action === 'pause') { return subManPause(subscriptionID); }
    if (action === 'terminate_next') { return subManTerminateNext(subscriptionID); }
    if (action === 'reset') { return subManReset(subscriptionID); }
    if (action === 'bill_now') { return subManBillNow(orderNo, orderToken, subscriptionID); }
    return false;
}

/**
 * Get a specific subscription from sticky.io
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - subscription data or false
 */
function getSubscription(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    var stickyioResponse = stickyioAPI('stickyio.http.get.subscriptions').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.object.result.status === 'SUCCESS') {
        return stickyioResponse.object.result.data;
    }
    return false;
}

/**
 * Get an order's custom field in sticky.io by token
 * @param {Object} customFields - array of custom field objects denoted by { token, value }
 * @param {string} token - the token of the custom field
 * @returns {Object} - the custom field if found
 */
function getStickyioCustomField(customFields, token) {
    let customField;

    if (customFields) {
        let i;
        for (i = 0; i < customFields.length; i++) {
            if (customFields[i].token_key === token) {
                customField = customFields[i];
                break;
            }
        }
    }

    return customField;
}
/**
 * Get billing model by ID
 * @param {number} billingModelId - the billing model id to look for
 * @returns {Object} - the billing model
 */
 function getBillingModelFromModels(billingModelId, billingModels) {
    var model;
    
    if (billingModels){
        var keys = [];
        keys = Object.keys(billingModels);
        
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var thisModel = billingModels[key];
            if (billingModelId == thisModel.id) {
                model = thisModel;
                break;
            }
        }
    }
    return  model;
}

/**
 * Get sticky's billing model by ID
 * @param {number} billingModelId - the billing model id to look for
 * @returns {Object} - the billing model
 */
 function getBillingModelById(billingModelId) {
    let params = {};
    let body = {};
    body.id = billingModelId;
    params.body = body;

    let stickyioResponse = stickyioAPI('stickyio.http.post.billing_model_view').call(params);
    if (stickyioResponse && !stickyioResponse.error && stickyioResponse.object && stickyioResponse.status === 'OK' && typeof(stickyioResponse.object.result.data) !== 'undefined') {
        return stickyioResponse.object.result.data[0];
    }

    return null;
}

/**
 * Get the delivery frequency from sticky billing model
 * @param {number} billingModelId - the id of the billing model
 * @returns {number} - the delivery frequency (in days)
 */
function getStickyioDeliveryFrequency(billingModelId, billingModel) {
    let frequency = 0;
    if (!billingModel) {
        //Retrieve individual option if it is not found in the list
        billingModel = getBillingModelById(billingModelId);
        if (billingModel) {
            switch (Number(billingModel.bill_by_type_id)) {
                case BILLING_MODEL_TYPE_BY_CYCLE:
                    frequency = Number(billingModel.bill_by_days);
                    break;
                default:
                    frequency = 0;
            }
        }
    } else {
        switch (Number(billingModel.type.id)) {
            case BILLING_MODEL_TYPE_BY_CYCLE:
                frequency = billingModel.frequency;
                break;
            default:
                frequency = 0;
        }
    }
    return frequency;
}

/**
 * Get the next delivery date
 * @param {Object} stickyOrderData - sticky's order data
 * @param {Object} currentProduct - current product data
 * @param {Object} currentDeliveryDate - the current delivery date
 * @returns {string} - the next delivery date
 */
 function getNextDeliveryDate(stickyOrderData, currentProduct, currentDeliveryDate, billingModel) {
    let nextDeliveryDate = currentDeliveryDate;
    let customerDeliveryDate = getStickyioCustomField(stickyOrderData.custom_fields, 'sfcc_customer_delivery_date');
    let currentCycle = getStickyioCustomField(stickyOrderData.custom_fields, 'sfcc_current_cycle');

    if (customerDeliveryDate && currentCycle) {
        let customerDeliveryDateValue = customerDeliveryDate.values[0].value;
        let currentCycleValue = parseInt(currentCycle.values[0].value, 10);
        let deliveryFrequency = getStickyioDeliveryFrequency(currentProduct.billing_model.id, billingModel);

        if (customerDeliveryDateValue.length > 0 && currentCycleValue >= 1 && deliveryFrequency > 0) {
            let date = new Date(customerDeliveryDateValue);
            date.setDate(date.getDate() + ((currentCycleValue-1) * deliveryFrequency));
            nextDeliveryDate = date.toISOString().substring(0, 10);
        }
    }

    return nextDeliveryDate;
}

module.exports = {
    stickyioAPI: stickyioAPI,
    sso: sso,
    updateShippingMethods: updateShippingMethods,
    getCampaigns: getCampaigns,
    getCampaignCustomObjectJSON: getCampaignCustomObjectJSON,
    getVariants: getVariants,
    hasSubscriptionProducts: hasSubscriptionProducts,
    validateAllProducts: validateAllProducts,
    validateProduct: validateProduct,
    getProductType: getProductType,
    createStraightSaleProduct: createStraightSaleProduct,
    getAllStickyioMasterProducts: getAllStickyioMasterProducts,
    syncOffers: syncOffers,
    syncProduct: syncProduct,
    sendNotificationEmail: sendNotificationEmail,
    subscriptionProductsLog: subscriptionProductsLog,
    offerProductsLog: offerProductsLog,
    getOrders: getOrders,
    updateSFCCShipping: updateSFCCShipping,
    updateStickyioShipping: updateStickyioShipping,
    orderShippingUpdate: orderShippingUpdate,
    shipmentUpdate: shipmentUpdate,
    getSubscriptionData: getSubscriptionData,
    updateSubscriptionDetails: updateSubscriptionDetails,
    updateStickyioCustomField: updateStickyioCustomField,
    voidStickyioOrder: voidStickyioOrder,
    stickyioSubMan: stickyioSubMan,
    generateObjects: generateObjects,
    cleanupFiles: cleanupFiles,
    getSubscription: getSubscription,
    getStickyioCustomField: getStickyioCustomField,
    getStickyioDeliveryFrequency: getStickyioDeliveryFrequency,
    getNextDeliveryDate: getNextDeliveryDate,
    getBillingModelById: getBillingModelById,
    getBillingModelFromModels: getBillingModelFromModels,
    getBillingModelsFromStickyio : getBillingModelsFromStickyio
};
