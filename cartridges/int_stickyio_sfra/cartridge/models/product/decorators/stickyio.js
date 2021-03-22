'use strict';

/**
 * Creates an object of the sticky.io attributes for a product
 * @param {dw.catalog.Product} product - SFCC product
 * @return {Object} an object containing the sticky.io attributes for a product.
 */
function getAttributes(product) {
    var Resource = require('dw/web/Resource');
    var Site = require('dw/system/Site');
    var stickyio = require('~/cartridge/scripts/stickyio');
    var attributes = {};
    var thisProduct = product;
    var stickyioCampaigns = stickyio.getCampaignCustomObjectJSON();
    if (thisProduct && stickyioCampaigns !== null && Object.keys(stickyioCampaigns).length > 0 && (thisProduct.custom.stickyioSubscriptionActive && thisProduct.custom.stickyioCampaignID !== null && stickyio.validateProduct(thisProduct, false))) {
        attributes.id = product.ID;
        attributes.stickyioBillingModelConsumerSelectable = thisProduct.custom.stickyioBillingModelConsumerSelectable;
        attributes.stickyioTermsConsumerSelectable = thisProduct.custom.stickyioTermsConsumerSelectable;
        attributes.stickyioPID = thisProduct.custom.stickyioProductID;
        attributes.stickyioCID = thisProduct.custom.stickyioCampaignID;
        attributes.stickyioVID = thisProduct.custom.stickyioVariationID;
        attributes.offers = {};
        var i;
        for (i = 1; i <= 3; i++) {
            if (thisProduct.custom['stickyioOffer' + i].value) {
                var offerID = thisProduct.custom['stickyioOffer' + i].value;
                attributes.offers[offerID] = { name: thisProduct.custom['stickyioOffer' + i].displayValue };
                var j;
                if (stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].is_prepaid && stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].prepaid_profile.terms && stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].prepaid_profile.terms.length > 0) {
                    attributes.offers[offerID].terms = [];
                    var thisTermCycles;
                    var thisTermID;
                    var thisTerm;
                    var discount;
                    if (attributes.stickyioTermsConsumerSelectable !== true) {
                        thisTermCycles = stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].prepaid_profile.terms[0].cycles;
                        thisTermID = offerID + '-' + thisTermCycles;
                        thisTerm = stickyioCampaigns.terms[thisTermID];
                        discount = thisTerm.type === 'Amount' ? Resource.msg('productdetail.currencysymbol.' + Site.getCurrent().getDefaultCurrency(), 'stickyio', '$') + parseInt(thisTerm.value, 10).toFixed(2) : thisTerm.value + '%';
                        attributes.offers[offerID].terms.push({ id: thisTermID, cycles: thisTerm.cycles, description: thisTerm.cycles + ' ' + Resource.msg('productdetail.cycles', 'stickyio', null) + ' ' + Resource.msg('productdetail.cycles.at', 'stickyio', null) + ' ' + discount + ' ' + Resource.msg('productdetail.cycles.off', 'stickyio', null) });
                    } else {
                        for (j = 0; j < stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].prepaid_profile.terms.length; j++) {
                            thisTermCycles = stickyioCampaigns.offers[thisProduct.custom['stickyioOffer' + i].value].prepaid_profile.terms[j].cycles;
                            thisTermID = offerID + '-' + thisTermCycles;
                            thisTerm = stickyioCampaigns.terms[thisTermID];
                            discount = thisTerm.type === 'Amount' ? Resource.msg('productdetail.currencysymbol.' + Site.getCurrent().getDefaultCurrency(), 'stickyio', '$') + parseInt(thisTerm.value, 10).toFixed(2) : thisTerm.value + '%';
                            attributes.offers[offerID].terms.push({ id: thisTermID, cycles: thisTerm.cycles, description: thisTerm.cycles + ' ' + Resource.msg('productdetail.cycles', 'stickyio', null) + ' ' + Resource.msg('productdetail.cycles.at', 'stickyio', null) + ' ' + discount + ' ' + Resource.msg('productdetail.cycles.off', 'stickyio', null) });
                        }
                    }
                }
                attributes.offers[offerID].billingModels = [];
                if (attributes.stickyioBillingModelConsumerSelectable !== true) {
                    attributes.offers[offerID].billingModels.push({ id: thisProduct.custom['stickyioBillingModels' + i][0].value, name: thisProduct.custom['stickyioBillingModels' + i][0].displayValue });
                } else {
                    for (j = 0; j < thisProduct.custom['stickyioBillingModels' + i].length; j++) {
                        attributes.offers[offerID].billingModels.push({ id: thisProduct.custom['stickyioBillingModels' + i][j].value, name: thisProduct.custom['stickyioBillingModels' + i][j].displayValue });
                    }
                }
            }
        }
        attributes.stickyioProductWrapper = thisProduct.ID;
        if (thisProduct.isVariant() && thisProduct.masterProduct.getVariants().length > 1) { attributes.stickyioProductWrapper = thisProduct.masterProduct.ID; }
        attributes.productType = stickyio.getProductType(thisProduct);
        attributes.stickyioSubscriptionActive = thisProduct.custom.stickyioSubscriptionActive;
        attributes.stickyioReady = thisProduct.custom.stickyioReady;
        attributes.stickyioOneTimePurchase = thisProduct.custom.stickyioOneTimePurchase;
        if (!attributes.stickyioOneTimePurchase && Object.keys(attributes.offers).length === 1) {
            attributes.stickyioOID = Object.keys(attributes.offers)[0];
            if (attributes.offers[Object.keys(attributes.offers)[0]].billingModels.length === 1) {
                attributes.stickyioBMID = attributes.offers[Object.keys(attributes.offers)[0]].billingModels[0].id;
            }
            if (attributes.offers[Object.keys(attributes.offers)[0]].terms) {
                attributes.offerType = 'prepaid';
                if (attributes.offers[Object.keys(attributes.offers)[0]].terms.length === 1) {
                    attributes.stickyioTID = attributes.offers[Object.keys(attributes.offers)[0]].terms[0].id;
                    attributes.stickyioCycles = attributes.offers[Object.keys(attributes.offers)[0]].terms[0].id.split('-')[1];
                }
            }
        }
    } else { attributes.stickyioReady = false; }

    return attributes;
}

module.exports = function (object, product) {
    Object.defineProperty(object, 'stickyio', {
        enumerable: true,
        value: getAttributes(product)
    });
};
