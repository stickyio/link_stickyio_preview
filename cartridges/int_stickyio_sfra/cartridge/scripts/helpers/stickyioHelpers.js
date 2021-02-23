'use strict';

/**
 * Make sure the sticky.io Billing Model ID is set and the baseURL is stripped of any redudant models added by the front-end
 * @param {string} pid - SFCC product id
 * @param {string} querystring - client querystring
 * @param {string} bmid - passed billing model id
 * @param {Object} productViewData - product view data
 * @returns {Object} updated response view data
 */
function setBaseURLAndBMID(pid, querystring, bmid, productViewData) {
    var URLUtils = require('dw/web/URLUtils');

    var thisQueryString = decodeURIComponent(querystring);
    var thisProductViewData = productViewData;
    var thisBMID = bmid;

    if (thisProductViewData.stickyio && thisProductViewData.stickyio.stickyioReady === true) {
        if (typeof (thisBMID) !== 'undefined') {
            if ((/^bmid/).test(thisQueryString)) {
                thisQueryString = thisQueryString.toString().replace(/^bmid=[0-9,]+&/, '');
            } else { thisQueryString = thisQueryString.toString().replace(/&bmid=[0-9,]+/, ''); }

            thisBMID = thisBMID.toString().split(',', 1)[0];
            thisQueryString += '&bmid=' + thisBMID;
        }

        // make sure the pid in the URL is for the actual product, in the case of sets
        if ((/pid=/).test(thisQueryString)) {
            thisQueryString = thisQueryString.toString().replace(/pid=(.+)\b/, 'pid=' + pid);
        }

        if (thisProductViewData.stickyio && !thisProductViewData.stickyio.stickyioBMID && typeof (thisBMID) !== 'undefined') { thisProductViewData.stickyio.stickyioBMID = thisBMID; }
        if (thisProductViewData.stickyio) { thisProductViewData.stickyio.stickyioBaseURL = URLUtils.url('Product-Variation') + '?' + thisQueryString; }
    }

    return thisProductViewData;
}

module.exports = {
    setBaseURLAndBMID: setBaseURLAndBMID
};
