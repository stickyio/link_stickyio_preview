'use strict';
var base = module.superModule;

base.emailTypes.stickyReminder = 7;
base.emailTypes.stickyCancel = 8;
base.emailTypes.stickyRebillDecline = 9;
base.emailTypes.stickyPause = 10;
base.emailTypes.stickyExpiredCard = 11;
base.emailTypes.stickyOutOfStock = 12;  

Object.keys(base).forEach(function (prop) {
    // eslint-disable-next-line no-prototype-builtins
    if (!module.exports.hasOwnProperty(prop)) {
        module.exports[prop] = base[prop];
    }
});
