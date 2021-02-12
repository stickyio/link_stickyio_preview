'use strict';

var getConfig = require('@tridnguyen/config');

var opts = Object.assign({}, getConfig({
    baseUrl: 'https://' + global.baseUrl + '/on/demandware.store/Sites-RefArch-Site/en_US',
    suite: '*',
    reporter: 'spec',
    timeout: 60000,
    locale: 'x_default'
}, './config.json'));


//All subscription-related tests will fail unless subscription products have been set up and synced with sticky.io due to real-time validation methods
//Subscription product variant 1
opts.variantPid1 = '640188016204M';
opts.qty1 = 1;
opts.stickyioProductID1 = 1;
opts.stickyioVariationID1 = 1;
opts.stickyioCampaignID1 = 1;
opts.stickyioOfferID1 = 1;
opts.stickyioBillingModelID1 = 6;
opts.stickyioBillingModelDetails1 = '60 Day Subscription';

module.exports = opts;
