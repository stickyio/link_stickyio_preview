'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

var stubStickyio = sinon.stub();

function proxyModel() {
    return {
        mocks: proxyquire('../../cartridges/int_stickyio_sfra/cartridge/models/product/decorators/index', {
            '*/cartridge/models/product/decorators/stickyio': stubStickyio
        }),
        stubs: {
            stubStickyio: stubStickyio
        }
    };
}

module.exports = proxyModel();
