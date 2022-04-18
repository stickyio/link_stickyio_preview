'use strict';

var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');

exports.emailSync = function (parameters) {
    stickyio.syncEmailPriorDays();
};