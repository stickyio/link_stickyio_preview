/**
 * The main sticky.io library providing API connectivity,
 * object parsing, storage and retrieval, validation and helper functions.
 * Function are selectively exported at the end for precise control.
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
var calendar = require('dw/util/Calendar');
var Shipment = require('dw/order/Shipment');
var Order = require('dw/order/Order');
var masterCampaignID = 1;
var tokenPrefix = 'sfcc_';
var subscriptionProductsLog = {};
var offerProductsLog = [];
var allStickyioProducts = {};

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
 * @param {Object} params - Params to be passed along to the service url and body
 * @returns {Object} - The results of the parsed service response
 */
function stickyioAPI(svcName) {
    var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
    var svc = LocalServiceRegistry.createService(svcName, {
        createRequest: function (thisSvc, params) {
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
            url = url.replace('{ENDPOINT}', endpoint + (params ? (params.id ? '/' + params.id : '') + (params.helper ? '/' + params.helper : '') + (params.id2 ? '/' + params.id2 : '') : ''));
            if (params.queryString) { url += '?' + params.queryString; }
            thisSvc.setRequestMethod(method);
            thisSvc.addHeader('Content-Type', 'application/json');
            if (endpoint === 'sso') { // special treatment for the versionless SSO endpoint
                url = url.replace('api/v2/', '');
                thisSvc.setAuthentication('NONE');
                thisSvc.addHeader('Platform-Key', Site.getCurrent().getCustomPreferenceValue('stickyioPlatformKey'));
            } else {
                thisSvc.setAuthentication('BASIC');
            }
            thisSvc.setURL(url);
            if (params && params.body) { return JSON.stringify(params.body); }
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
    params.helper = 'login';
    params.body = {};
    params.body.username = user;
    params.body.email = Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com';
    params.body.fullname = 'Customer Service';
    params.body.department_id = 'demandware';
    var stickyioResponse = stickyioAPI('stickyio.http.post.sso.login').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.code === 200) {
        return stickyioResponse.object.result.url + '?redirect=' + redirect;
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
    var mimeEncodedText = require('dw/value/MimeEncodedText');
    if (thisBody === '') { thisBody = 'Nothing to do.'; }
    var mail = new Mail();
    mail.addTo(emailAddress);
    mail.setFrom(Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com');
    mail.setSubject(subject);
    mail.setContent(mimeEncodedText(thisBody));
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
    if (theseShippingMethods === null) { theseShippingMethods = {}; }
    var params = {};
    if (!thisPageNum) { thisPageNum = 1; }
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.shipping').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
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
    var stickyioShippingMethods = getShippingMethods();
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

/** Get all existing products from sticky.io and return an Object of product_skus containing the product_id
 * @returns {Object} - Return object of products or false if no products
 *
 */
function getAllStickyioProducts() {
    if (allStickyioProducts && Object.keys(allStickyioProducts).length > 0) { return allStickyioProducts; }
    var returnProducts = {};
    var params = {};
    params.body = {};
    params.body.product_id = 'all';
    var stickyioResponse = stickyioAPI('stickyio.http.post.product_index').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.response_code === '100' && parseInt(stickyioResponse.object.result.total_products, 10) > 0) {
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

/**
 * Get the product IDs (SFCC and sticky.io) from the allStickyioProducts global object
 * @param {string} sfccProductID - SFCC sku/pid
 * @param {number} stickyioProductID - sticky.io product ID
 * @returns {Object} - Return IDs or false
 */
function getCorrespondingPIDandName(sfccProductID, stickyioProductID) {
    if (sfccProductID && allStickyioProducts && allStickyioProducts[sfccProductID]) { return { sfccProductID: sfccProductID, stickyioProductID: allStickyioProducts[sfccProductID].stickyioProductID, name: allStickyioProducts[sfccProductID].name }; }
    if (stickyioProductID && allStickyioProducts) {
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
 * Get a product or just its ID from SFCC
 * @param {boolean} returnProduct - boolean to declare if product should be returned or just its ID
 * @param {string} passedPID - Function passed product ID
 * @returns {Object} - Return SFCC product, product id, boolean false (if not found), or JSON
 */
function getProduct(returnProduct, passedPID) {
    var product = ProductMgr.getProduct(passedPID);
    if (returnProduct) {
        if (product) { return product; }
        return false;
    }
    if (!product) { return JSON.stringify(product.ID); }
    return { error: 'Product with ID ' + passedPID + ' not found.' };
}

/**
 * Method to get the SFCC product type
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {string} - Product type
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
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
    if (thisCampaignData === null) { thisCampaignData = {}; }
    var params = {};
    if (!thisPageNum) { thisPageNum = 1; }
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.campaigns').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
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
 * Add a new object to the custom object campaignData that keys each
 * Subscription Product to its relevant Campaign/Offer/Billing Model for easy and quick access.
 * @param {Object} campaignProducts - Object containing the sticky.io Campaign's products
 * @param {string} SFCCProductID - SFCC Product ID, but returned from sticky.io
 * @param {string} name - SFCC Product name
 * @param {number} productID - sticky.io Product ID
 * @param {number} variantID - sticky.io Variant ID
 * @param {Object} variantAttributes - sticky.io Variant Attributes
 * @param {number} campaignID - sticky.io Campaign ID
 * @param {number} offerID - sticky.io Offer ID
 * @param {number} bmID - sticky.io Billing Model ID
 * @param {boolean} skipBillingModel - boolean flag to skip storage of a billing model if it's been archived in sticky.io
 * @returns {Object} - Return campaignProducts object
 */
function addCampaignProductData(campaignProducts, SFCCProductID, name, productID, variantID, variantAttributes, campaignID, offerID, bmID, skipBillingModel) {
    var productType = getProductType(ProductMgr.getProduct(SFCCProductID));
    var theseCampaignProducts = campaignProducts;
    if (typeof (theseCampaignProducts[SFCCProductID]) === 'undefined') { // does the SKU exist in our theseCampaignProducts array?
        if (variantID) {
            theseCampaignProducts[SFCCProductID] = { name: name, productType: productType, product_id: productID, variant_id: variantID, attributes: variantAttributes, campaigns: {} };
        } else { theseCampaignProducts[SFCCProductID] = { name: name, productType: productType, product_id: productID, campaigns: {} }; }
    }
    if (typeof (theseCampaignProducts[SFCCProductID].campaigns[campaignID]) === 'undefined') { // does the campaignID exist for this SKU?
        theseCampaignProducts[SFCCProductID].campaigns[campaignID] = { offers: {} };
    }
    if (typeof (theseCampaignProducts[SFCCProductID].campaigns[campaignID].offers[offerID]) === 'undefined') { // does the offerID for this campaignID exist?
        theseCampaignProducts[SFCCProductID].campaigns[campaignID].offers[offerID] = { billing_models: [] };
    }
    if (bmID && !skipBillingModel && theseCampaignProducts[SFCCProductID].campaigns[campaignID].offers[offerID].billing_models.indexOf(bmID) === -1) { // does the billingModelID for this offerID exist?
        theseCampaignProducts[SFCCProductID].campaigns[campaignID].offers[offerID].billing_models.push(bmID);
    }
    return theseCampaignProducts;
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
    var campaignProducts = {};
    var i;
    var j;
    var k;
    var m;
    var z;
    for (i = 0; i < Object.keys(thisCampaignData).length; i++) {
        var thisCampaignID = Object.keys(thisCampaignData)[i];
        var thisCampaign = thisCampaignData[thisCampaignID];
        var offerObject = {};
        for (j = 0; j < thisCampaign.offers.length; j++) {
            var billingModelObject = {};
            var thisBillingModel;
            var skipBillingModel;
            var thisOffer = thisCampaign.offers[j];
            if (!thisOffer.is_archived) {
                if (thisOffer.products.length > 0) {
                    for (k = 0; k < thisOffer.products.length; k++) {
                        var thisProduct = thisOffer.products[k];
                        var thisProductData = getCorrespondingPIDandName(null, thisProduct.id);
                        var thisSFCCProduct = ProductMgr.getProduct(thisProductData.sfccProductID);
                        if (thisSFCCProduct) {
                            if (thisProductData && typeof (thisProductData.name) !== 'undefined' && thisProductData.name !== '') {
                                campaignProducts = addCampaignProductData(campaignProducts, thisProductData.sfccProductID, thisProductData.name, thisProduct.id, null, null, thisCampaign.id, thisOffer.id);
                                thisCampaignData[thisCampaignID].offers[j].products[k].sku_num = thisProductData.sfccProductID;
                                var theseProductVariants = getVariants(thisProduct.id);
                                for (z = 0; z < theseProductVariants.length; z++) {
                                    var thisProductVariant = theseProductVariants[z];
                                    campaignProducts = addCampaignProductData(campaignProducts, thisProductVariant.sku_num, thisProductData.name, thisProduct.id, thisProductVariant.id, thisProductVariant.attributes, thisCampaign.id, thisOffer.id);
                                    for (m = 0; m < thisOffer.billing_models.length; m++) {
                                        thisBillingModel = thisOffer.billing_models[m];
                                        skipBillingModel = false;
                                        if (thisBillingModel.is_archived) { skipBillingModel = true; }
                                        campaignProducts = addCampaignProductData(campaignProducts, thisProductVariant.sku_num, thisProductData.name, thisProduct.id, thisProductVariant.id, thisProductVariant.attributes, thisCampaign.id, thisOffer.id, thisBillingModel.id, skipBillingModel);
                                    }
                                }
                                thisCampaignData[thisCampaignID].offers[j].products[k].variants = [];
                                thisCampaignData[thisCampaignID].offers[j].products[k].variants = theseProductVariants;
                                for (m = 0; m < thisOffer.billing_models.length; m++) {
                                    thisBillingModel = thisOffer.billing_models[m];
                                    if (thisBillingModel.id === 2 && Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleBillingModelName') !== '') {
                                        // rename the Straight Sale billing model
                                        thisBillingModel.name = Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleBillingModelName');
                                    }
                                    skipBillingModel = false;
                                    if (thisBillingModel.is_archived) { skipBillingModel = true; }
                                    campaignProducts = addCampaignProductData(campaignProducts, thisProductData.sfccProductID, thisProductData.name, thisProduct.id, null, null, thisCampaign.id, thisOffer.id, thisBillingModel.id, skipBillingModel);
                                    if (!skipBillingModel) { billingModelObject[thisBillingModel.id] = thisBillingModel; }
                                }
                            } else {
                                throw new Error('Invalid product data in Campaign or global sticky.io products object.');
                            }
                        }
                    }
                } else {
                    for (m = 0; m < thisOffer.billing_models.length; m++) {
                        thisBillingModel = thisOffer.billing_models[m];
                        if (thisBillingModel.id === 2 && Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleBillingModelName') !== '') {
                            // rename the Straight Sale billing model
                            thisBillingModel.name = Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleBillingModelName');
                        }
                        skipBillingModel = false;
                        if (thisBillingModel.is_archived) { skipBillingModel = true; }
                        if (!skipBillingModel) { billingModelObject[thisBillingModel.id] = thisBillingModel; }
                    }
                }
                if (Object.keys(billingModelObject).length > 0) { thisOffer.billing_models = billingModelObject; } // change the billing_model array in to an object with the id as key
                offerObject[thisOffer.id] = thisOffer; // now that we've processed the products, change the offer array in to an object with the id as key
            }
        }
        if (Object.keys(offerObject).length > 0) { thisCampaign.offers = offerObject; }
    }
    thisCampaignData.campaignProducts = campaignProducts;
    return thisCampaignData;
}

/**
 * Get sticky.io Campaigns custom object
 * @returns {Object} - SFCC Custom Object
*/
function getCampaignCustomObject() {
    var stickyioCampaigns = {};
    stickyioCampaigns = CustomObjectMgr.getCustomObject('stickyioCampaigns', 'campaigns');
    return stickyioCampaigns;
}

/**
 * Get sticky.io Campaigns custom object JSON data
 * @returns {Object} - sticky.io campaign data
*/
function getCampaignCustomObjectJSON() {
    return JSON.parse(getCampaignCustomObject().custom.jsonData);
}

/**
 * Get sticky.io Offer IDs
 * @param {string} pid - SFCC Product ID
 * @param {number} cid - sticky.io Campaign ID
 * @returns {Object} - Array of offer IDs
*/
function getOfferIDs(pid, cid) {
    if (!pid || !cid) { return []; }
    var offerIDs = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON();
    try {
        offerIDs = Object.keys(stickyioCampaigns.campaignProducts[pid].campaigns[cid].offers);
    } catch (e) {
        return [];
    }
    return offerIDs;
}

/**
 * Get sticky.io Billing Model IDs
 * @param {string} pid - SFCC Product ID
 * @param {number} cid - sticky.io Campaign ID
 * @param {number} oid - sticky.io Offer ID
 * @returns {Array} - Array of billing model IDs
*/
function getBillingModelIDs(pid, cid, oid) {
    if (!pid || !cid || !oid) { return []; }
    var billingModelIDs = [];
    var stickyioCampaigns = getCampaignCustomObjectJSON();
    try {
        billingModelIDs = stickyioCampaigns.campaignProducts[pid].campaigns[cid].offers[oid].billing_models;
    } catch (e) {
        return [];
    }
    return billingModelIDs;
}

/**
 * Method to make sure selected billing models and offer actually exist in our custom object campaign data
 * of sticky.io Campaign/Offer/Billing Models
 * @param {dw.catalog.Product} product - Product
 * @param {boolean} allowTransaction - Allow a transaction to update the custom sticky.io property
 * (only true when function is not in a storefront context)
 * @returns {boolean} - boolean result
*/
function validateProduct(product, allowTransaction) {
    var thisProduct = product;
    if (thisProduct &&
        thisProduct.custom.stickyioOfferID !== null && ((
            thisProduct.custom.stickyioOfferID.value === '0' &&
            thisProduct.custom.stickyioCustomOfferID !== null
        ) || thisProduct.custom.stickyioOfferID.value !== '0')
    ) {
        var thisCampaignID = thisProduct.custom.stickyioCampaignID;
        var offerIDType = 'stickyioOfferID';
        var billingModelType = 'stickyioBillingModels';
        var thisOfferID;
        if (thisProduct.custom.stickyioOfferID.value === '0' && thisProduct.custom.stickyioCustomOfferID !== null) {
            offerIDType = 'stickyioCustomOfferID';
            billingModelType = 'stickyioCustomBillingModels';
        }
        if (offerIDType === 'stickyioOfferID') {
            thisOfferID = thisProduct.custom[offerIDType].value;
        } else {
            thisOfferID = thisProduct.custom[offerIDType];
        }
        if (thisOfferID === null) { // no offers set for this products, so turn it off
            if (allowTransaction === true) {
                Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; });
            }
            return false;
        }
        var productOffers = getOfferIDs(thisProduct.ID, thisCampaignID);
        if (productOffers === false || productOffers.length === 0 || (productOffers.length > 0 && thisOfferID !== null && productOffers.indexOf(thisOfferID.toString()) === -1)) { // offer id not found for the master campaign
            if (allowTransaction === true) {
                Transaction.wrap(function () { thisProduct.custom.stickyioReady = false; });
            }
            return false;
        }
        // offer is good, proceed to check billing models
        var productBillingModels = getBillingModelIDs(thisProduct.ID, thisCampaignID, thisOfferID);
        // stickyioBillingModels is an enum of strings, and there may be more than one available to a consumer
        // stickyioCustomBillingModels is a set of ints, and there may be more than one
        var i;
        for (i = 0; i < thisProduct.custom[billingModelType].length; i++) {
            var thisBillingModelID;
            if (billingModelType === 'stickyioBillingModels') {
                thisBillingModelID = parseInt(thisProduct.custom[billingModelType][i].value, 10);
            } else {
                thisBillingModelID = thisProduct.custom[billingModelType][i];
            }
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
}

/**
 * Remove unused campaign data to keep size of custom object down
 * @param {Object} campaignData - Campaign data from sticky.io
 * @returns {Object} - Return pruned campaignData object
 */
function pruneCampaignData(campaignData) {
    var keepKeys = ['is_active', 'id', 'is_archived', 'name', 'description', 'offers']; // keys to keep
    var thisCampaignData = campaignData;
    Object.keys(thisCampaignData).forEach(function (campaignID) {
        Object.keys(thisCampaignData[campaignID]).forEach(function (key) {
            if (keepKeys.indexOf(key) === -1) {
                delete (thisCampaignData[campaignID][key]);
            }
        });
    });
    return thisCampaignData;
}

/**
 * Get Campaigns from sticky.io or from the SFCC custom object
 * @param {boolean} isJob - Determine if this method was called in a job context
 * @param {Object} parameters - Parameters from a job context
 * @returns {Object} - Return campaignData object or true
 */
function getCampaigns(isJob, parameters) {
    allStickyioProducts = getAllStickyioProducts();
    var stickyioCampaigns = {};
    var campaignData = {};
    var campaignJSON = {};
    stickyioCampaigns = getCampaignCustomObject();
    if (Object.keys(stickyioCampaigns).length === 0) { // if we don't have a default object, create one
        Transaction.wrap(function () {
            stickyioCampaigns = CustomObjectMgr.createCustomObject('stickyioCampaigns', 'campaigns');
        });
    }
    campaignData = getCampaignsFromStickyio(1, null);
    if (Object.keys(campaignData).length > 0) {
        campaignJSON.updateTime = new Date();
        campaignData = reshapeCampaignData(campaignData);
        campaignJSON.campaignProducts = campaignData.campaignProducts;
        delete (campaignData.campaignProducts);
        campaignJSON.campaigns = pruneCampaignData(campaignData);
        Transaction.wrap(function () {
            stickyioCampaigns.custom.jsonData = JSON.stringify(campaignJSON);
        });
    }
    validateAllProducts();
    if (isJob === true) {
        if (parameters && parameters['Email Log'] && parameters['Email Address'] !== '') {
            var content = '';
            content = 'Raw Campaign Data:\n';
            content += JSON.stringify(campaignJSON, null, '\t');
            sendNotificationEmail(parameters['Email Address'].toString(), content, 'Campaign Update Log');
        }
    }
    return true;
}

/**
 * Update sticky.io Offer with SFCC Products
 * @param {number} offerID - sticky.io Offer ID
 * @param {Object} stickyioProductIDs - Single sticky.io Product ID or an array of sticky.io Product IDs
 * @returns {boolean} - boolean return
*/
function updateOffer(offerID, stickyioProductIDs) {
    var theseOfferProducts = [];
    if (typeof (stickyioProductIDs) !== 'object') { // we were only given a single PID, so we need to pull all the PIDs for this offer
        var products = ProductMgr.queryAllSiteProducts();
        while (products.hasNext()) {
            var product = products.next();
            if (product && product.custom.stickyioOfferID.value === offerID) {
                if (theseOfferProducts.indexOf(offerID) === -1) {
                    theseOfferProducts.push(offerID);
                }
            }
        }
        if (theseOfferProducts.indexOf(stickyioProductIDs) === -1) {
            theseOfferProducts.push(stickyioProductIDs); // now add the single PID we were given
        }
    } else { theseOfferProducts = stickyioProductIDs; }
    if (theseOfferProducts.length > 0) {
        var params = {};
        params.id = offerID;
        params.body = {};
        params.body.products = theseOfferProducts.map(function (id) { return { id: id }; });
        var stickyioResponse = stickyioAPI('stickyio.http.put.offers').call(params);
        if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
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
        thisProduct.custom.stickyioLastSync = null; // date + time
        thisProduct.custom.stickyioCustomOfferID = null; // int
        thisProduct.custom.stickyioCustomBillingModels = []; // set of int
        thisProduct.custom.stickyioOfferID = null; // enum of strings
        thisProduct.custom.stickyioBillingModels = null; // enum of strings
        thisProduct.custom.stickyioVertical = null; // enum of strings
        thisProduct.custom.stickyioReady = null; // boolean
        thisProduct.custom.stickyioBillingModelConsumerSelectable = null; // boolean
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
        return stickyioResponse;
    }
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) === 'undefined') {
        return true; // this product doesn't have any attributes, but it's valid
    }
    return false; // this product failed being retrieved from sticky.io
}


/**
 * Get all custom fields from sticky.io
 * @param {number} pageNum - Pagination page number
 * @param {Array} customFields - sticky.io custom fields array
 * @returns {Object} - customFields array
*/
function getCustomFields(pageNum, customFields) {
    var i;
    var thisPageNum = pageNum;
    var theseCustomFields = customFields;
    if (!thisPageNum) { thisPageNum = 1; }
    var params = {};
    params.queryString = 'page=' + thisPageNum;
    var stickyioResponse = stickyioAPI('stickyio.http.get.custom_fields').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        for (i = 0; i < stickyioResponse.object.result.data.length; i++) {
            theseCustomFields.push(stickyioResponse.object.result.data[i]);
        }
        if (thisPageNum < parseInt(stickyioResponse.object.result.last_page, 10)) { thisPageNum++; getCustomFields(thisPageNum, theseCustomFields); }
        return theseCustomFields;
    }
    return theseCustomFields;
}

/**
 * Get existing custom field from sticky.io
 * @param {string} tokenKey - sticky.io custom field token ID
 * @returns {Object} - Returns the custom field ID or false if not found
*/
function getCustomField(tokenKey) {
    var i;
    var customFields = getCustomFields(null, []);
    if (customFields.length > 0) {
        for (i = 0; i < customFields.length; i++) {
            var thisCustomField = customFields[i];
            if (thisCustomField.token_key === tokenKey) { return thisCustomField.id; }
        }
        return false;
    }
    return false;
}

/**
 * Create a new custom field in sticky.io
 * and saves the resultant ID to SFCC custom preference
 * @param {string} customPreferenceID - The SFCC custom preference
 * @param {string} customFieldName - The sticky.io custom field name
 * @param {string} tokenKey - The token of the sticky.io custom field
 * @param {number} fieldTypeID - sticky.io field type ID (options available in sticky.io docs)
 * @param {number} typeID - sticky.io type ID (options available in sticky.io docs)
 * @param {boolean} reset - boolean flag to force update of the local SFCC preference associated with this custom field
 * @returns {void}
*/
function createCustomField(customPreferenceID, customFieldName, tokenKey, fieldTypeID, typeID, reset) {
    if (reset || Site.getCurrent().getCustomPreferenceValue(customPreferenceID) === null) { // create the custom field!
        var customField = getCustomField(tokenPrefix + tokenKey);
        if (!customField) {
            var params = {};
            var body = {};
            body.name = customFieldName;
            body.field_type_id = fieldTypeID;
            body.type_id = typeID;
            body.is_multi = false;
            body.token_key = tokenPrefix + tokenKey;
            params.body = body;
            var stickyioResponse = stickyioAPI('stickyio.http.post.custom_fields').call(params);
            if (!stickyioResponse.error && (stickyioResponse.object.result.status === 'SUCCESS' && stickyioResponse.object.result.data.id)) {
                try {
                    Transaction.wrap(function () { Site.getCurrent().setCustomPreferenceValue(customPreferenceID, parseInt(stickyioResponse.object.result.data.id, 10)); });
                } catch (e) {
                    Logger.error('Error while setting SFCC ' + customPreferenceID + ' custom preference.');
                    throw e;
                }
            }
        } else { // custom field already exists in sticky.io, so let's just update the SFCC preference
            try {
                Transaction.wrap(function () { Site.getCurrent().setCustomPreferenceValue(customPreferenceID, parseInt(customField, 10)); });
            } catch (e) {
                Logger.error('Error while setting SFCC ' + customPreferenceID + ' custom preference.');
                throw e;
            }
        }
    }
}

/**
 * Delete a variant from sticky.io
 * @param {number} variantID - sticky.io variant ID
 * @param {number} productID - sticky.io product ID
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
 * @param {string} masterProductID - SFCC product ID
 * @param {Object} productVariants - SFCC product variants
 * @param {number} iterator - Current position from calling function
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
                        theseProductVariants[i].custom.stickyioLastSync = calendar().time; // set the last sync time to now
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
                thisProduct.custom.stickyioLastSync = calendar().time; // set the last sync time to now
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
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {void}
 */
function updateLastSync(product) {
    var thisProduct = product;
    Transaction.wrap(function () { thisProduct.custom.stickyioLastSync = calendar().time; });
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
    var existantProduct = getCorrespondingPIDandName(product.ID); // check to see if this product exists in sticky.io
    if (existantProduct) { // it exists
        if (persistStickyIDs && product.custom.stickyioProductID !== existantProduct.stickyioProductID) {
            updateProductID(product, existantProduct.stickyioProductID);
            newProduct = false;
        }
    }
    var productChange = false;
    var stickyioData = {};
    if (product.isVariant() && product.masterProduct.custom.stickyioSubscriptionActive === true) { stickyioData.stickyioResponse = 'skip'; } // this is a variant bound to a subscribe-able master, so don't create it as a stand-alone product
    if (calendar(product.getLastModified()) > product.custom.stickyioLastSync) { productChange = true; }
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
                    if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS') { updateSFCCVariantAttributes(product, stickyioResponse.object.result.data, resetProductVariants, persistStickyIDs); }
                }
            } else if (!compareAttributes(product, stickyioResponse.object.result.data)) { // this is an existing master product, so let's make sure things match
                stickyioResponse = addVariantAttributes(product); // SFCC variant attributes and sticky.io attributes don't match
            }
            // let's make sure prices and SKUs and such match
            stickyioResponse = getVariants(product.custom.stickyioProductID, true);
            if (stickyioResponse && stickyioResponse.object.result.status === 'SUCCESS') { updateSFCCVariantAttributes(product, stickyioResponse.object.result.data, resetProductVariants, persistStickyIDs); }
        }
        updateLastSync(product); // set the last sync time for the master to now
    }
}

/** Get the active billing models of a SFCC Product
 * @param {dw.catalog.Product} product - SFCC Product
 * @param {boolean} customOffer - boolean flag to indicate if this Product's Offer is custom
 * @returns {Object} - Array of active billing model IDs
 */
function getActiveBillingModels(product, customOffer) {
    var stickyioproductAvailableBillingModels = [];
    var i;
    if (product) { // we don't want to check for the bogus straightSale product
        var stickyioCustom = false;
        if (customOffer) {
            stickyioCustom = customOffer;
        } else if (product.custom.stickyioOfferID.value === '0') { stickyioCustom = true; }
        if (stickyioCustom) {
            for (i = 0; i < product.custom.stickyioCustomBillingModels.length; i++) {
                stickyioproductAvailableBillingModels.push(product.custom.stickyioCustomBillingModels[i]);
            }
        } else {
            for (i = 0; i < product.custom.stickyioBillingModels.length; i++) {
                stickyioproductAvailableBillingModels.push(parseInt(product.custom.stickyioBillingModels[i].value, 10).toString());
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
    if (thisProductSetProduct.custom.stickyioBillingModelConsumerSelectable === null && productSet.custom.stickyioBillingModelConsumerSelectable) { thisProductSetProduct.custom.stickyioBillingModelConsumerSelectable = productSet.custom.stickyioBillingModelConsumerSelectable; }
    if (thisProductSetProduct.custom.stickyioOfferID.value === null && productSet.custom.stickyioOfferID) { thisProductSetProduct.custom.stickyioOfferID = productSet.custom.stickyioOfferID.value; }
    if (thisProductSetProduct.custom.stickyioBillingModels.length === 0 && productSet.custom.stickyioBillingModels.length > 0) { thisProductSetProduct.custom.stickyioBillingModels = getActiveBillingModels(productSet); }
    if (!thisProductSetProduct.custom.stickyioCustomOfferID && productSet.custom.stickyioCustomOfferID) { thisProductSetProduct.custom.stickyioCustomOfferID = productSet.custom.stickyioCustomOfferID; }
    if (!thisProductSetProduct.custom.stickyioCustomBillingModels && productSet.custom.stickyioCustomBillingModels) { thisProductSetProduct.custom.stickyioCustomBillingModels = productSet.custom.stickyioCustomBillingModels; }
    Transaction.commit();
}

/**
 * Build the global offerProducts array
 * @param {dw.catalog.Product} product - SFCC product
 * @returns {Object} - offerProducts
 */
function buildOfferProducts() {
    var offerProducts = {};
    if(allStickyioProducts) {
        Object.keys(allStickyioProducts).forEach(function (productID) {
            var product = ProductMgr.getProduct(productID);
            if (product && product.custom.stickyioProductID !== null && product.custom.stickyioOfferID.value !== null && product.custom.stickyioOfferID.value !== '0') {
                if (!offerProducts[product.custom.stickyioOfferID.value]) { offerProducts[product.custom.stickyioOfferID.value] = []; }
                if (offerProducts[product.custom.stickyioOfferID.value].indexOf(product.custom.stickyioProductID) === -1) {
                    offerProducts[product.custom.stickyioOfferID.value].push(product.custom.stickyioProductID);
                }
            }
            if (product && product.custom.stickyioProductID !== null && product.custom.stickyioOfferID.value === '0' && product.custom.stickyioCustomOfferID !== null) {
                if (!offerProducts[product.custom.stickyioCustomOfferID]) { offerProducts[product.custom.stickyioCustomOfferID] = []; }
                if (offerProducts[product.custom.stickyioCustomOfferID].indexOf(product.custom.stickyioProductID) === -1) {
                    offerProducts[product.custom.stickyioCustomOfferID].push(product.custom.stickyioProductID);
                }
            }
        });
    }
    return offerProducts;
}

/**
 * Make sure all products are bound to their offers and push results to the global offerProductsLog
 * @returns {void}
 */
function syncOffers() {
    var offerProducts = buildOfferProducts();
    // get all existing offerIDs from sticky.io
    // if there exists an offerID in sticky.io that does not exist in offerProducts, we need to update that offer in sticky.io with no products
    var i;
    for (i = 0; i < Object.keys(offerProducts).length; i++) {
        if (updateOffer(Object.keys(offerProducts)[i], offerProducts[Object.keys(offerProducts)[i]])) {
            offerProductsLog.push('Synced Offer ' + Object.keys(offerProducts)[i]);
        } else {
            offerProductsLog.push('Error syncing Offer ' + Object.keys(offerProducts)[i]);
        }
    }
}

/**
 * Sync products between SFCC and sticky.io
 * @param {dw.catalog.Product} product - SFCC product
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
    if (localAllStickyioProducts === null) {
        allStickyioProducts = getAllStickyioProducts();
    } else { allStickyioProducts = localAllStickyioProducts; }

    if (thisProduct && thisProduct.custom.stickyioSubscriptionActive === true && !subscriptionProductsLog[thisProduct.ID]) {
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
 * Business Manager Product Config save method for subscription
 * products with custom offers and billing models
 * @param {Object} request - httpParameterMap object from the client call
 * @returns {Object} - JSON response
*/
function saveProduct(request) {
    var pid = request.pid.value;
    var stickyioBillingModelConsumerSelectable = !!JSON.parse(request.cs.value);
    var stickyioCustomOfferID = Number(request.oid.value);
    var stickyioCustomBillingModelsRaw = JSON.parse(request.bmid.value); // billing models are an array
    var stickyioCustomBillingModels = [];
    var outputJSON = {};
    var i;
    for (i = 0; i < stickyioCustomBillingModelsRaw.length; i++) {
        stickyioCustomBillingModels.push(Number(stickyioCustomBillingModelsRaw[i]));
    }
    var product = ProductMgr.getProduct(pid);
    if (product) {
        if (stickyioCustomOfferID !== '0') {
            if (stickyioCustomBillingModels.length === 0 || stickyioCustomBillingModels[0] === '0') {
                if (stickyioCustomBillingModels.length === 0) {
                    outputJSON = { error: 'Billing Model can not be blank if Consumer Selectable is unchecked.' };
                } else { outputJSON = { error: 'Billing Model can not be Custom.' }; }
            } else {
                // allStickyioProducts = getAllStickyioProducts();
                createOrUpdateProduct(product);
                // update the Offer in sticky.io. If it's valid, update the data locally as well
                if (updateOffer(stickyioCustomOfferID, product.custom.stickyioProductID)) {
                    try {
                        Transaction.wrap(function () {
                            product.custom.stickyioCampaignID = masterCampaignID;
                            product.custom.stickyioCustomOfferID = stickyioCustomOfferID;
                            product.custom.stickyioCustomBillingModels = stickyioCustomBillingModels;
                            product.custom.stickyioBillingModelConsumerSelectable = stickyioBillingModelConsumerSelectable;
                            product.custom.stickyioReady = true;
                            product.custom.stickyioLastSync = calendar().time; // set the last sync time to now
                        });
                        outputJSON = { result: 'Saved! Syncing sticky.io data...' };
                    } catch (e) {
                        outputJSON = { error: e.message };
                    }
                } else {
                    outputJSON = { error: 'There was a problem saving the subscription configuration in sticky.io.' };
                }
            }
        } else { outputJSON = { error: 'OfferID can not be blank or Custom.' }; }
    } else { outputJSON = { error: 'Product with ID ' + pid + ' not found.' }; }
    return outputJSON;
}

/**
 * Method to get all SFCC subscription products that are set to custom offer
 * @returns {Array} - Custom offer products
*/
function getCustomOfferProducts() {
    var returnProducts = [];
    var products = ProductMgr.queryAllSiteProducts();
    while (products.hasNext()) {
        var product = products.next();
        if (product && product.custom.stickyioSubscriptionActive === true && product.custom.stickyioOfferID.value === '0' && getProductType(product).match(/product|master|bundle|productset/i)) {
            returnProducts.push(product);
        }
    }
    return returnProducts;
}

/**
 * Method to make sure our productLineItem has a valid combination
 * of sticky.io Campaign/Offer/Billing Models
 * @param {dw.order.ProductLineItem} product - Basket/Order product line item
 * @returns {boolean} - boolean result
*/
function validateLineItem(product) {
    var thisCampaignID;
    var thisOfferID;
    var productOffers;
    var thisBillingModelID;
    var productBillingModels;
    if (product && product.custom.stickyioOfferID !== null && product.custom.stickyioBillingModelID !== null) {
        if (product.custom.stickyioOfferID !== null) {
            thisCampaignID = product.custom.stickyioCampaignID;
            thisOfferID = product.custom.stickyioOfferID;
            productOffers = getOfferIDs(product.productID, thisCampaignID);
            if (productOffers.length === 0 || (productOffers.length > 0 && productOffers.indexOf(thisOfferID.toString()) === -1)) { // offer id not found for this campaign
                return false;
            }
        }
        if (product.custom.stickyioOfferID !== null && product.custom.stickyioBillingModelID !== null) {
            thisCampaignID = product.custom.stickyioCampaignID;
            thisOfferID = product.custom.stickyioOfferID;
            thisBillingModelID = product.custom.stickyioBillingModelID;
            productBillingModels = getBillingModelIDs(product.productID, thisCampaignID, thisOfferID);
            if (productBillingModels === false || productBillingModels.length === 0 || (productBillingModels.length > 0 && productBillingModels.indexOf(thisBillingModelID) === -1)) { // billing model id not found for this offer
                return false;
            }
        }
        return true;
    }
    return false;
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
 * @param {boolean} reset - boolean flag to force update of the preference
 * @returns {void}
*/
function createStraightSaleProduct(reset) {
    var thisReset = reset;
    var stickyioResponse;
    var params = {};
    var body = {};
    var existingStraightSaleID = Site.getCurrent().getCustomPreferenceValue('stickyioStraightSaleProductID');
    if (existingStraightSaleID) { // check to see if this already exists at sticky.io and, if so and it matches our straight sale sku, just use it
        body.product_id = existingStraightSaleID;
        params.body = body;
        stickyioResponse = stickyioAPI('stickyio.http.post.product_index').call(params);
        if (!stickyioResponse.error && (stickyioResponse.object.result.response_code === '100')) {
            if (stickyioResponse.object.result.products[existingStraightSaleID].product_sku !== 'stickyioStraightSale') { // this stickyioProductID we have stored doesn't match the straightSale product
                thisReset = true; // reset it
            }
        } else { thisReset = true; }
    }
    if (thisReset || !existingStraightSaleID) {
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
        if (!stickyioResponse.error && (stickyioResponse.object.result.response_code === '100' && stickyioResponse.object.result.new_product_id)) {
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
 * Get billing model details for sticky.io orders and append all available Billing Models to the order object's subscription product(s)
 * @param {Object} orders - Object of sticky.io orders
 * @param {boolean} activeBillingModels - boolean flag to only return active billing models according to the current SFCC product
 * @returns {Object} - Returns sticky.io order object with appended details
 */
function getOrderBillingModels(orders, activeBillingModels) {
    var i;
    var j;
    var k;
    var theseOrders = orders;
    for (i = 0; i < Object.keys(theseOrders.data).length; i++) {
        var thisStickyioOrder = theseOrders.data[Object.keys(theseOrders.data)[i]];
        for (j = 0; j < thisStickyioOrder.products.length; j++) {
            var thisStickyioOrderProduct = thisStickyioOrder.products[j];
            var productActiveBillingModels = getActiveBillingModels(ProductMgr.getProduct(thisStickyioOrderProduct.sku));
            var billingModels = [];
            var params = {};
            params.id = thisStickyioOrderProduct.subscription_id;
            params.helper = 'billing_models';
            var stickyioResponse = stickyioAPI('stickyio.http.get.subscriptions.billing_models').call(params);
            if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS' && typeof (stickyioResponse.object.result.data) !== 'undefined') {
                for (k = 0; k < stickyioResponse.object.result.data.length; k++) {
                    var thisBillingModel = stickyioResponse.object.result.data[k];
                    if (activeBillingModels && productActiveBillingModels.length > 0) { // only allow billing models thare are allowed by the product currently
                        if (productActiveBillingModels.indexOf(thisBillingModel.id) !== -1 && thisBillingModel.id !== 2) { // always exclude Straight Sale
                            billingModels.push(stickyioResponse.object.result.data[k]);
                        }
                    } else if (thisBillingModel.id !== 2) { // include all billing models, excluding Straight Sale billing model
                        billingModels.push(stickyioResponse.object.result.data[k]);
                    }
                }
                if (billingModels.length > 0) {
                    theseOrders.data[Object.keys(theseOrders.data)[i]].products[j].billing_models = billingModels;
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
    orders.data = {};
    var params = {};
    var body = {};
    body.order_id = orderNumbers;
    params.body = body;
    var stickyioResponse = stickyioAPI('stickyio.http.post.order_view').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.response_code === '100') {
        if (typeof (stickyioResponse.object.result.data) === 'undefined') { // single order return
            orders.data[stickyioResponse.object.result.order_id] = stickyioResponse.object.result;
        } else { // multi order return
            orders.data = stickyioResponse.object.result.data;
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
    if (!stickyioResponse.error && stickyioResponse.object.result.response_code === '100') {
        return true;
    }
    return false;
}

/**
 * Update this order shipping status
 * @param {string} orderNo - SFCC order number
 * @returns {boolean} - boolean result
 */
function orderShippingUpdate(orderNo) { // loop through all order shipments and see if they're shipped or not, then update the order shipping status
    var order = OrderMgr.getOrder(orderNo);
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
 * Append the sticky.io order subscription data to our orderModel's product line items
 * for display to the consumer.
 * @param {Object} orderModel - SFCC orderModel
 * @param {Object} stickyioOrderData - sticky.io order
 * @returns {Object} - The updated orderModel
 */
function appendPLIs(orderModel, stickyioOrderData) {
    var thisOrderModel = orderModel;
    var x;
    var y;
    var i;
    var j;
    for (x = 0; x < thisOrderModel.shipping.length; x++) {
        var thisShippingModel = thisOrderModel.shipping[x];
        for (y = 0; y < thisShippingModel.productLineItems.items.length; y++) {
            var lineItem = thisShippingModel.productLineItems.items[y];
            for (i = 0; i < Object.keys(stickyioOrderData).length; i++) {
                var thisStickyioOrder = stickyioOrderData[Object.keys(stickyioOrderData)[i]];
                for (j = 0; j < thisStickyioOrder.products.length; j++) {
                    var thisStickyioOrderProduct = thisStickyioOrder.products[j];
                    if (thisStickyioOrderProduct.subscription_id === lineItem.stickyioSubscriptionID) {
                        lineItem.is_recurring = !!+thisStickyioOrderProduct.is_recurring;
                        lineItem.on_hold = !!+thisStickyioOrderProduct.on_hold;
                        if (thisStickyioOrderProduct.hold_date !== '') {
                            lineItem.hold_date = thisStickyioOrderProduct.hold_date;
                            lineItem.recurring_date = Resource.msg('label.subscriptionmanagement.on_hold', 'stickyio', null) + ' ' + lineItem.hold_date;
                        } else { lineItem.recurring_date = thisStickyioOrderProduct.recurring_date; }
                        lineItem.billingModels = thisStickyioOrderProduct.billing_models;
                        thisShippingModel.productLineItems.items[y] = lineItem;
                    }
                }
            }
        }
        thisOrderModel.shipping[x] = thisShippingModel;
    }
    return thisOrderModel;
}

/**
 * Commit the transaction to update the PLI details from sticky.io
 * @param {Object} product - sticky.io product data for an order
 * @param {dw.order.Shipment.ProductLineItem} pli - Shipment product line item
 * @returns {void}
 */
function commitOrderDetails(product, pli) {
    var thisPLI = pli;
    Transaction.wrap(function () {
        if (product.billing_model.id !== thisPLI.custom.stickyioBillingModelID) {
            thisPLI.custom.stickyioBillingModelID = Number(product.billing_model.id);
        }
        if (product.billing_model.name !== thisPLI.custom.stickyioBillingModelDetails) {
            thisPLI.custom.stickyioBillingModelDetails = product.billing_model.name;
        }
    });
}

/**
 * Update the SFCC shipment with the lastest sticky.io information
 * @param {string} stickyioOrderNo - sticky.io order number
 * @param {dw.order.Shipment} shipment - Order shipment tied to this sticky.io order
 * @returns {Object} - The new (or original) sticky.io order number
 */
function updateStickyioOrderDetails(stickyioOrderNo, shipment) {
    var thisShimpment = shipment;
    var i;
    var j;
    var stickyioOrderData = getOrders([stickyioOrderNo]);
    if (stickyioOrderData) {
        var thisStickyioOrder = stickyioOrderData.data[[Object.keys(stickyioOrderData.data)[0]]];
        for (i = 0; i < thisShimpment.productLineItems.length; i++) {
            var thisPLI = thisShimpment.productLineItems[i];
            if (thisPLI.custom.stickyioSubscriptionID) {
                for (j = 0; j < thisStickyioOrder.products.length; j++) {
                    var thisStickyioProduct = thisStickyioOrder.products[j];
                    if (thisStickyioProduct.subscription_id === thisPLI.custom.stickyioSubscriptionID) {
                        commitOrderDetails(thisStickyioProduct, thisPLI); // it's possible a CSR has changed the billing model for a customer, so update it here
                    }
                }
            }
        }
        if (thisStickyioOrder.child_id !== '') { // there might be a newer order number for this order, so update it
            var latestOrderNo = thisStickyioOrder.child_id.split(',');
            latestOrderNo = latestOrderNo[latestOrderNo.length - 1];
            if (stickyioOrderNo !== latestOrderNo) {
                Transaction.wrap(function () { thisShimpment.custom.stickyioOrderNo = latestOrderNo; });
                return latestOrderNo;
            }
            return null;
        }
        return stickyioOrderNo;
    }
    return null;
}

/**
 * Update the orderView object with sticky.io subscription
 * management possibilities to turn off/on consumer control
 * @param {Object} orderView - The existing orderView object
 * @param {dw.order.Order} order - The original order
 * @returns {Object} - Updated orderView object
 */
function updateOrderView(orderView, order) {
    var thisOrderView = orderView;
    var stickyioOrderNumbers = [];
    var orderShipments = order.getShipments();
    var i;
    for (i = 0; i < orderShipments.length; i++) {
        if (orderShipments[i].custom.stickyioOrderNo) {
            var thisStickyioOrderNo = updateStickyioOrderDetails(orderShipments[i].custom.stickyioOrderNo, orderShipments[i]);
            if (thisStickyioOrderNo) { stickyioOrderNumbers.push(thisStickyioOrderNo); }
        }
    }

    if (stickyioOrderNumbers.length > 0) {
        thisOrderView.stickyioOrderData = getOrders(stickyioOrderNumbers, true, true);

        thisOrderView.stickyioAllowRecurring = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowRecurringDate');
        thisOrderView.stickyioAllowUpdateBillingModel = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowUpdateBillingModel');

        thisOrderView.stickyioAllowSubManSelect = true;
        thisOrderView.stickyioAllowSubManStartOptions = true;
        thisOrderView.stickyioAllowSubManStopOptions = true;

        thisOrderView.stickyioAllowResume = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowResume');
        thisOrderView.stickyioAllowReset = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowReset');
        thisOrderView.stickyioAllowBillNow = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowBillNow');

        thisOrderView.stickyioAllowPause = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowPause');
        thisOrderView.stickyioAllowStop = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowStop');
        thisOrderView.stickyioAllowTerminateNext = Site.getCurrent().getCustomPreferenceValue('stickyioSubManAllowTerminateNext');

        if (thisOrderView.stickyioAllowResume !== true
            && thisOrderView.stickyioAllowReset !== true
            && thisOrderView.stickyioAllowBillNow !== true
        ) { thisOrderView.stickyioAllowSubManStartOptions = false; }
        if (thisOrderView.stickyioAllowPause !== true
            && thisOrderView.stickyioAllowStop !== true
            && thisOrderView.stickyioAllowTerminateNext !== true
        ) { thisOrderView.stickyioAllowSubManStopOptions = false; }
        if (!thisOrderView.stickyioAllowSubManStartOptions && !thisOrderView.stickyioAllowSubManStopOptions) { thisOrderView.stickyioAllowSubManSelect = false; }
    }
    return thisOrderView;
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.billing_model', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.recur_at', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
}

/**
 * Pause the sticky.io subscription
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManPause(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    params.helper = 'pause';
    var stickyioResponse = stickyioAPI('stickyio.http.put.subscriptions.pause').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.pause', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
}

/**
 * Stop the sticky.io subscription
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManStop(subscriptionID) {
    var params = {};
    params.id = subscriptionID;
    params.helper = 'stop';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.stop').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.stop', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.terminate_next', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
}

/**
 * Update the SFCC custom sticky.io orderID attribute
 * @param {Object} shipment - SFCC shipment
 * @param {string} orderID - sticky.io order ID
 * @returns {void}
 */
function updateOrderID(shipment, orderID) {
    var thisShipment = shipment;
    Transaction.wrap(function () { thisShipment.custom.stickyioOrderNo = orderID; });
}

/**
 * Start the sticky.io subscription
 * @param {string} orderNo - SFCC order number
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManStart(orderNo, subscriptionID) {
    var i;
    var j;
    var params = {};
    params.id = subscriptionID;
    params.helper = 'start';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.start').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        // update the original SFCC order's lineitem sticky.io order ID
        var newOrderID = stickyioResponse.object.result.data.orderId;
        var order = OrderMgr.getOrder(orderNo);
        var orderShipments = order.getShipments();
        for (i = 0; i < orderShipments.length; i++) {
            var thisShipment = orderShipments[i];
            for (j = 0; j < thisShipment.productLineItems.length; j++) {
                var thisPLI = thisShipment.productLineItems[j];
                if (thisPLI.custom.stickyioSubscriptionID === subscriptionID) {
                    updateOrderID(thisShipment, newOrderID);
                    return { message: Resource.msg('label.subscriptionmanagement.response.start', 'stickyio', null) };
                }
            }
        }
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
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
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        return { message: Resource.msg('label.subscriptionmanagement.response.reset', 'stickyio', null) };
    }
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
}

/**
 * Bill the sticky.io subscription now
 * @param {string} orderNo - SFCC order number
 * @param {string} subscriptionID - sticky.io subscription ID
 * @returns {Object} - result of the call
 */
function subManBillNow(orderNo, subscriptionID) {
    var i;
    var j;
    var params = {};
    params.id = subscriptionID;
    params.helper = 'bill_now';
    var stickyioResponse = stickyioAPI('stickyio.http.post.subscriptions.bill_now').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        // update the original SFCC order's lineitem sticky.io order ID
        var newOrderID = stickyioResponse.object.result.data.orderId;
        var order = OrderMgr.getOrder(orderNo);
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
    return { error: true, message: JSON.parse(stickyioResponse.errorMessage) };
}

/**
 * Make the change the subscription as indicated by the user
 * @param {string} orderNo - SFCC order number
 * @param {string} subscriptionID - sticky.io subscription ID
 * @param {string} action - Subscription management action
 * @param {number} bmID - Billing Model ID to change to
 * @param {string} date - Date to change to
 * @returns {Object} - result of the change
 */
function stickyioSubMan(orderNo, subscriptionID, action, bmID, date) {
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
    if (action === 'stop') { return subManStop(subscriptionID); }
    if (action === 'terminate_next') { return subManTerminateNext(subscriptionID); }
    if (action === 'start') { return subManStart(orderNo, subscriptionID); }
    if (action === 'reset') { return subManReset(subscriptionID); }
    if (action === 'bill_now') { return subManBillNow(orderNo, subscriptionID); }
    return false;
}

/**
 * Generates a unique promo id prexied by a sticky.io varant
 * @returns {string} A unique promo ID
 */
function generateStickyioPromoID() {
    var UUIDUtils = require('dw/util/UUIDUtils');
    return 'stickyio-' + UUIDUtils.createUUID();
}

/**
 * Actually create the discount for a lineItem
 * This is not currently in use and SFCC is considered
 * the system of truth for discounts.
 * @param {boolean} percentDiscount - Percent discount type or amount type
 * @param {Object} stickyioItem - sticky.io product
 * @param {Object} lineItem - SFCC lineitem
 * @returns {void}
 */
function createDiscount(percentDiscount, stickyioItem, lineItem) {
    var PercentageDiscount = require('dw/campaign/PercentageDiscount');
    var AmountDiscount = require('dw/campaign/AmountDiscount');
    var discount;
    if (percentDiscount) {
        discount = new PercentageDiscount(stickyioItem.discount.percent);
    } else { discount = new AmountDiscount(stickyioItem.discount.total); }
    Transaction.wrap(function () { lineItem.createPriceAdjustment(generateStickyioPromoID(), discount); });
}

/**
 * Remove existing sticky.io-applied adjustment for a lineItem
 * This is not currently in use and SFCC is considered
 * the system of truth for discounts.
 * @param {Object} lineItem - SFCC lineitem
 * @param {Object} adjustment - SFCC price adjustment
 * @returns {void}
 */
function removeStickyioAdjustment(lineItem, adjustment) {
    Transaction.wrap(function () { lineItem.removePriceAdjustment(adjustment); });
}

/**
 * Apply discounts from sticky.io to a Basket
 * This is not currently in use and SFCC is considered
 * the system of truth for discounts.
 * @param {dw.order.Basket} basket - The customer's basket
 * @returns {boolean} - Only possible return is a success
 */
function applyDiscounts(basket) {
    var plis = basket.getAllProductLineItems();
    if (!plis) { return false; }
    var params = {};
    params.helper = 'calculate';
    var body = {};
    var offers = [];
    var thisLineItem;
    var i;
    var j;
    var k;
    for (i = 0; i < plis.length; i++) {
        thisLineItem = plis[i];
        if (thisLineItem.custom.stickyioOfferID !== null) {
            var thisOffer = {};
            body.campaign_id = thisLineItem.custom.stickyioCampaignID;
            thisOffer.id = thisLineItem.custom.stickyioOfferID;
            thisOffer.product_id = thisLineItem.custom.stickyioProductID;
            thisOffer.billing_model_id = thisLineItem.custom.stickyioBillingModelID;
            thisOffer.quantity = thisLineItem.quantity.value;
            offers.push(thisOffer);
        }
    }
    // body.shipping_id = ShippingMgr.defaultShippingMethod.custom.stickyioShippingID;
    // safer to loop through all shipping methods until we find one that has the attribute we need
    var shippingMethods = ShippingMgr.getAllShippingMethods();
    for (i = 0; i < shippingMethods.length; i++) {
        var thisShippingMethod = shippingMethods[i];
        if (thisShippingMethod.custom.stickyioShippingID) {
            body.shipping_id = thisShippingMethod.custom.stickyioShippingID;
            break;
        }
    }
    body.use_tax_provider = -1;
    body.offers = offers;
    params.body = body;
    var stickyioResponse = stickyioAPI('stickyio.http.post.order_total.calculate').call(params);
    if (!stickyioResponse.error && stickyioResponse.object.result.status === 'SUCCESS') {
        for (i = 0; i < plis.length; i++) {
            thisLineItem = plis[i];
            if (thisLineItem.custom.stickyioOfferID !== null) {
                for (j = 0; j < stickyioResponse.object.result.data.line_items.length; j++) {
                    var thisStickyioItem = stickyioResponse.object.result.data.line_items[j];
                    if (thisLineItem.custom.stickyioProductID === thisStickyioItem.id) {
                        // remove all stickyio- promotions for this lineitem, if any
                        var priceAdjustments = thisLineItem.getPriceAdjustments();
                        if (priceAdjustments.length > 0) {
                            for (k = 0; k < priceAdjustments.length; k++) {
                                var thisPriceAdjustment = priceAdjustments[k];
                                if ((/^stickyio-/).test(thisPriceAdjustment.promotionID)) {
                                    removeStickyioAdjustment(thisLineItem, thisPriceAdjustment);
                                }
                            }
                        }
                        if (thisStickyioItem.discount) { // add new promotions based on returned data
                            createDiscount(thisStickyioItem.discount.percent, thisStickyioItem, thisLineItem);
                        }
                    }
                }
            }
        }
    }
    return true;
}

module.exports = {
    stickyioAPI: stickyioAPI,
    sso: sso,
    updateShippingMethods: updateShippingMethods,
    getProduct: getProduct,
    getCampaigns: getCampaigns,
    getCampaignCustomObjectJSON: getCampaignCustomObjectJSON,
    saveProduct: saveProduct,
    getVariants: getVariants,
    hasSubscriptionProducts: hasSubscriptionProducts,
    validateAllProducts: validateAllProducts,
    validateProduct: validateProduct,
    validateLineItem: validateLineItem,
    getProductType: getProductType,
    createStraightSaleProduct: createStraightSaleProduct,
    createCustomField: createCustomField,
    syncProduct: syncProduct,
    sendNotificationEmail: sendNotificationEmail,
    subscriptionProductsLog: subscriptionProductsLog,
    offerProductsLog: offerProductsLog,
    syncOffers: syncOffers,
    getOrders: getOrders,
    getActiveBillingModels: getActiveBillingModels,
    updateSFCCShipping: updateSFCCShipping,
    updateStickyioShipping: updateStickyioShipping,
    orderShippingUpdate: orderShippingUpdate,
    shipmentUpdate: shipmentUpdate,
    updateOrderView: updateOrderView,
    appendPLIs: appendPLIs,
    updateStickyioOrderDetails: updateStickyioOrderDetails,
    stickyioSubMan: stickyioSubMan,
    getCustomOfferProducts: getCustomOfferProducts,
    applyDiscounts: applyDiscounts
};
