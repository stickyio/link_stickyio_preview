'use strict';

var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');

exports.campaignSync = function (parameters) {
    stickyio.getCampaigns(true, parameters);
};
