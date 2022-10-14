'use strict';

var base = module.superModule;
var decorators = require('~/cartridge/models/product/decorators/index');

module.exports = function bundleProduct(product, apiProduct, options, factory) {
    base.call(this, product, apiProduct, options, factory);
    decorators.stickyio(product, apiProduct);
    return product;
};