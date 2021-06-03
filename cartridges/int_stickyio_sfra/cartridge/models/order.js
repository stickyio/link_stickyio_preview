'use strict';

var base = module.superModule;

module.exports = function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);
    this.stickyioOrder = Object.hasOwnProperty.call(lineItemContainer, 'stickyioOrder')
    ? lineItemContainer.stickyioOrder
    : false;
};
