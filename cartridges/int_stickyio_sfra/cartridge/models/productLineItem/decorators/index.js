'use strict';

module.exports = {
    gift: require('*/cartridge/models/productLineItem/decorators/gift'),
    bonusProductLineItem: require('*/cartridge/models/productLineItem/decorators/bonusProductLineItem'),
    appliedPromotions: require('*/cartridge/models/productLineItem/decorators/appliedPromotions'),
    renderedPromotions: require('*/cartridge/models/productLineItem/decorators/renderedPromotions'),
    uuid: require('*/cartridge/models/productLineItem/decorators/uuid'),
    orderable: require('*/cartridge/models/productLineItem/decorators/orderable'),
    shipment: require('*/cartridge/models/productLineItem/decorators/shipment'),
    priceTotal: require('*/cartridge/models/productLineItem/decorators/priceTotal'),
    quantityOptions: require('*/cartridge/models/productLineItem/decorators/quantityOptions'),
    options: require('*/cartridge/models/productLineItem/decorators/options'),
    quantity: require('*/cartridge/models/productLineItem/decorators/quantity'),
    bundledProductLineItems: require('*/cartridge/models/productLineItem/decorators/bundledProductLineItems'),
    bonusProductLineItemUUID: require('*/cartridge/models/productLineItem/decorators/bonusProductLineItemUUID'),
    preOrderUUID: require('*/cartridge/models/productLineItem/decorators/preOrderUUID'),
    discountBonusLineItems: require('*/cartridge/models/productLineItem/decorators/discountBonusLineItems'),
    bonusUnitPrice: require('*/cartridge/models/productLineItem/decorators/bonusUnitPrice'),
    stickyioProductID: require('~/cartridge/models/productLineItem/decorators/stickyioProductID'),
    stickyioVariationID: require('~/cartridge/models/productLineItem/decorators/stickyioVariationID'),
    stickyioCampaignID: require('~/cartridge/models/productLineItem/decorators/stickyioCampaignID'),
    stickyioOfferID: require('~/cartridge/models/productLineItem/decorators/stickyioOfferID'),
    stickyioBillingModelID: require('~/cartridge/models/productLineItem/decorators/stickyioBillingModelID'),
    stickyioBillingModelDetails: require('~/cartridge/models/productLineItem/decorators/stickyioBillingModelDetails'),
    stickyioSubscriptionID: require('~/cartridge/models/productLineItem/decorators/stickyioSubscriptionID')
};
