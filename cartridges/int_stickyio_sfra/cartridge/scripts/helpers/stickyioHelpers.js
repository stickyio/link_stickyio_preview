'use strict';

/**
 * Make sure the querystring is stripped of any redudant models added by the front-end
 * @param {string} pid - SFCC product id
 * @param {Object} querystring - client querystring
 * @param {Object} productViewData - product view data
 * @returns {Object} updated response view data
 */
function setBaseURLAndBMID(pid, querystring, productViewData) {
    var URLUtils = require('dw/web/URLUtils');

    var thisQueryString = decodeURIComponent(querystring);
    var thisProductViewData = productViewData;
    var thisOfferType = querystring.offerType;
    var thisOID;
    var thisBMID;
    var thisTID;
    var selectedQuantity = 1;
    if (querystring.quantity) {
        selectedQuantity = querystring.quantity;
    } else if (thisProductViewData.selectedQuantity) {
        selectedQuantity = thisProductViewData.selectedQuantity;
    }

    if (thisProductViewData.stickyio && thisProductViewData.stickyio.stickyioReady === true) {
        // make sure the pid in the URL is for the actual product, in the case of sets
        if ((/pid=/).test(thisQueryString)) {
            thisQueryString = thisQueryString.toString().replace(/pid=(.+)\b/, 'pid=' + pid);
        }

        // strip offerType from the baseURL
        if (typeof (thisOfferType) !== 'undefined') {
            if ((/^offerType/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^offerType=prepaid+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&offerType=prepaid+/, ''); }
        }

        // always strip quantity (we replace at end)
        if ((/quantity=/).test(thisQueryString)) {
            if ((/^quantity/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^(quantity=[0-9]+)+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&(quantity=[0-9]+)+/, ''); }
        }

        if ((/(dwopt(.+?)stickyioBillingModelOptions=[0-9-]+)/).test(thisQueryString)) {
            var stickyioBillingModelOptions = thisQueryString.match(/(dwopt(.+?)stickyioBillingModelOptions=([0-9-]+))/)[3];
            if ((/^(dwopt(.+?)stickyioBillingModelOptions=[0-9-]+)/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^(dwopt(.+?)stickyioBillingModelOptions=[0-9-]+)+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&(dwopt(.+?)stickyioBillingModelOptions=[0-9-]+)+/, ''); }
            thisBMID = stickyioBillingModelOptions;
        }

        if ((/(dwopt(.+?)stickyioOfferOptions=[0-9-]+)/).test(thisQueryString)) {
            var stickyioOfferOptions = thisQueryString.match(/(dwopt(.+?)stickyioOfferOptions=([0-9-]+))/)[3];
            if ((/^(dwopt(.+?)stickyioOfferOptions=[0-9-]+)/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^(dwopt(.+?)stickyioOfferOptions=[0-9-]+)+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&(dwopt(.+?)stickyioOfferOptions=[0-9-]+)+/, ''); }
            thisOID = stickyioOfferOptions;
        }

        if ((/(dwopt(.+?)stickyioTermOptions=[0-9-]+)/).test(thisQueryString)) {
            var stickyioTermOptions = thisQueryString.match(/(dwopt(.+?)stickyioTermOptions=([0-9-]+))/)[3];
            if ((/^(dwopt(.+?)stickyioTermOptions=[0-9-]+)/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^(dwopt(.+?)stickyioTermOptions=[0-9-]+)+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&(dwopt(.+?)stickyioTermOptions=[0-9-]+)+/, ''); }
            thisTID = stickyioTermOptions;
        }

        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.stickyioOID && typeof (thisOID) !== 'undefined') { thisProductViewData.stickyio.stickyioOID = thisOID; }
        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.stickyioBMID && typeof (thisBMID) !== 'undefined') { thisProductViewData.stickyio.stickyioBMID = thisBMID; }
        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.stickyioTID && typeof (thisTID) !== 'undefined') {
            thisProductViewData.stickyio.stickyioTID = thisTID;
        }
        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.offerType && typeof (thisOfferType) !== 'undefined') { thisProductViewData.stickyio.offerType = thisOfferType; }
        if (thisProductViewData.stickyio &&
            thisProductViewData.stickyio.stickyioOneTimePurchase &&
            ((!thisProductViewData.stickyio.stickyioOID &&
            typeof (thisOID) === 'undefined') ||
                thisOID === '0'
            ) &&
            ((!thisProductViewData.stickyio.stickyioBMID &&
            typeof (thisBMID) === 'undefined') ||
                thisBMID === '0'
            ) &&
            (!thisProductViewData.stickyio.offerType &&
            typeof (thisOfferType) === 'undefined')
        ) {
            thisProductViewData.stickyio.stickyioOID = '1';
            thisProductViewData.stickyio.stickyioBMID = '2';
        }
        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.selectedQuantity && typeof (selectedQuantity) !== 'undefined') { thisProductViewData.stickyio.selectedQuantity = selectedQuantity; }
        if (thisProductViewData.stickyio) { thisProductViewData.stickyio.stickyioBaseURL = URLUtils.url('Product-Variation') + '?' + thisQueryString + '&quantity=' + selectedQuantity; }
    }

    return thisProductViewData;
}

module.exports = {
    setBaseURLAndBMID: setBaseURLAndBMID
};
