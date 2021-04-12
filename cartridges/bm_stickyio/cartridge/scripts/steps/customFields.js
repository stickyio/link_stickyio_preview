'use strict';

var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio'); // hard-coded path to shared sticky.io library

exports.customFields = function (parameters) {
    stickyio.createStraightSaleProduct(parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldSiteID', 'SFCC Site ID', 'site_id', 1, 2, parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldHostname', 'SFCC Hostname', 'hostname', 1, 2, parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldOrderNo', 'SFCC Order Number', 'order_number', 1, 2, parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldShipmentID', 'SFCC Shipment ID', 'shipment_id', 1, 2, parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldCustomerID', 'SFCC Customer ID', 'customer_id', 1, 2, parameters['Wipe SFCC Data']);
    stickyio.createCustomField('stickyioCustomFieldOrderToken', 'SFCC Order Token', 'order_token', 1, 2, parameters['Wipe SFCC Data']);
};
