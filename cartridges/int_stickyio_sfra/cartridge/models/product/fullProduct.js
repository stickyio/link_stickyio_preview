'use strict';

var base = module.superModule;
var decorators = require('~/cartridge/models/product/decorators/index');

module.exports = function fullProduct(product, apiProduct, options) {
    base.call(this, product, apiProduct, options);
    decorators.stickyio(product, apiProduct);
    return product;
};
