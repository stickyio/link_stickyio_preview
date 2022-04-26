'use strict';

var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');
var Status = require('dw/system/Status');

exports.emailSync = function (parameters) {
    if (stickyio.syncEmailPriorDays()) {
        return new Status(Status.OK);
    } else {
        return new Status(Status.ERROR);
    }
    
};