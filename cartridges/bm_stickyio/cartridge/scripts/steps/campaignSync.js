'use strict';

var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');

exports.campaignSync = function (parameters) {
    var allStickyioProducts = stickyio.getAllStickyioMasterProducts();
    stickyio.getCampaigns(parameters);
    stickyio.syncOffers(allStickyioProducts);
};
