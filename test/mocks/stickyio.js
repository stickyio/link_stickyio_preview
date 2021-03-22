'use strict';

var stickyioCampaigns = { "products": { "1": { "stickyioProductID": 2, "name": "Charcoal Single Pleat Striped Wool Suit" } }, "offers": { "1": { "id": 1, "name": "Standard" }, "2": { "id": 2, "name": "Prepaid Offer", "is_prepaid": 1, "prepaid_profile": { "terms": [{ "cycles": 3, "discount_value": "20.00", "discount_type": { "id": 1, "name": "Percent" } }, { "cycles": 5, "discount_value": "500.00", "discount_type": { "id": 2, "name": "Amount" } }] } } }, "terms": { "2-3": { "cycles": 3, "value": 20, "type": "Percent" }, "2-5": { "cycles": 5, "value": 500, "type": "Amount" } }, "billingModels": { "2": { "id": 2, "name": "One Time Purchase" }, "3": { "id": 3, "name": "90 Days" }, "4": { "id": 4, "name": "Annually" } } };

var stickyio = {
    getCampaignCustomObjectJSON: function() { return stickyioCampaigns; },
    validateProduct: function() { return true; },
    getActiveBillingModels: function() { return ['3','4']; },
    getProductType: function() { return 'master'; }
};

module.exports = stickyio;