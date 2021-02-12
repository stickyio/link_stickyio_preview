'use strict';

/**
 * Creates an object of the stick.io attributes for a product
 * @param {dw.catalog.Product} product - SFCC product
 * @return {Object} an object containing the sticky.io attributes for a product.
 */
function getAttributes(product) {
    var stickyio = require('~/cartridge/scripts/stickyio');
    var attributes = {};
    var thisProduct = product;
    var stickyioCampaigns = stickyio.getCampaignCustomObjectJSON();
    if (thisProduct && stickyioCampaigns !== null && Object.keys(stickyioCampaigns).length > 0 && (thisProduct.custom.stickyioSubscriptionActive && thisProduct.custom.stickyioCampaignID !== null && stickyio.validateProduct(thisProduct))) {
        attributes.id = product.ID;
        attributes.stickyioBillingModelConsumerSelectable = thisProduct.custom.stickyioBillingModelConsumerSelectable;
        attributes.stickyioPID = thisProduct.custom.stickyioProductID;
        attributes.stickyioCID = thisProduct.custom.stickyioCampaignID;
        attributes.stickyioVID = thisProduct.custom.stickyioVariationID;
        var stickyioProductCampaignData = stickyioCampaigns.campaignProducts[thisProduct.ID];
        attributes.stickyioOID = thisProduct.custom.stickyioOfferID.value;
        var stickyioCustom = false;
        if (attributes.stickyioOID === '0') { // custom offerID indicator
            attributes.stickyioOID = thisProduct.custom.stickyioCustomOfferID;
            stickyioCustom = true;
        }
        var stickyioproductAvailableBillingModels = stickyio.getActiveBillingModels(thisProduct, stickyioCustom);
        attributes.stickyioproductCampaignID = thisProduct.custom.stickyioCampaignID.toString(); // this is always 1, but we read it from thisProduct just to be sure
        attributes.stickyioProductBillingModels = {};
        var i;
        for (i = 0; i < stickyioProductCampaignData.campaigns[attributes.stickyioproductCampaignID].offers[attributes.stickyioOID.toString()].billing_models.length; i++) {
            var thisBillingModelData = stickyioCampaigns.campaigns[attributes.stickyioproductCampaignID].offers[attributes.stickyioOID.toString()].billing_models[stickyioProductCampaignData.campaigns[attributes.stickyioproductCampaignID].offers[attributes.stickyioOID.toString()].billing_models[i].toString()];
            if (stickyioproductAvailableBillingModels.indexOf(thisBillingModelData.id.toString()) !== -1) {
                var thisBillingModel = {};
                thisBillingModel.id = thisBillingModelData.id;
                thisBillingModel.name = thisBillingModelData.name;
                attributes.stickyioProductBillingModels[thisBillingModelData.id] = thisBillingModel;
            }
        }
        if (attributes.stickyioBillingModelConsumerSelectable !== true) { attributes.stickyioBMID = stickyioproductAvailableBillingModels[0]; }
        attributes.stickyioProductWrapper = thisProduct.ID;
        if (thisProduct.isVariant() && thisProduct.masterProduct.getVariants().length > 1) { attributes.stickyioProductWrapper = thisProduct.masterProduct.ID; }
        attributes.productType = stickyio.getProductType(thisProduct);
        attributes.stickyioSubscriptionActive = thisProduct.custom.stickyioSubscriptionActive;
        attributes.stickyioReady = thisProduct.custom.stickyioReady;
    } else { attributes.stickyioReady = false; }

    return attributes;
}

module.exports = function (object, product) {
    Object.defineProperty(object, 'stickyio', {
        enumerable: true,
        value: getAttributes(product)
    });
};
