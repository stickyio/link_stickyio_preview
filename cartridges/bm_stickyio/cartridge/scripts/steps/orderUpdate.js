'use strict';

var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var stickyio = require('int_stickyio_sfra/cartridge/scripts/stickyio');

exports.orderUpdateStickyioToSFCC = function (parameters) {
    var stickyioOrders = [];
    var stickyioOrderNumbers = [];
    var changedOrders = [];
    var stickyioOrderData = false;
    var thisShipment = {};
    var i;
    var j;
    var k;
    var orders = OrderMgr.searchOrders('custom.stickyioOrder = {0} AND shippingStatus = {1} OR shippingStatus = {2}', 'creationDate asc', true, Order.SHIPPING_STATUS_NOTSHIPPED, Order.SHIPPING_STATUS_PARTSHIPPED);
    while (orders.hasNext()) {
        var order = orders.next();
        var thisOrderObject = {};
        thisOrderObject.orderNo = order.orderNo;
        thisOrderObject.shipments = [];
        var orderShipments = order.getShipments();
        for (i = 0; i < orderShipments.length; i++) {
            thisShipment = {};
            if (orderShipments[i].custom.stickyioOrderNo) {
                thisShipment.id = orderShipments[i].ID;
                var thisStickyioOrderNo = stickyio.updateStickyioOrderDetails(orderShipments[i].custom.stickyioOrderNo, orderShipments[i]);
                thisShipment.stickyioOrderNo = thisStickyioOrderNo;
                stickyioOrderNumbers.push(thisStickyioOrderNo);
                thisOrderObject.shipments.push(thisShipment);
            }
        }
        if (thisOrderObject.shipments.length > 0) { stickyioOrders.push(thisOrderObject); }
    }
    if (stickyioOrders.length > 0 && stickyioOrderNumbers.length > 0) {
        stickyioOrderData = stickyio.getOrders(stickyioOrderNumbers);
        if (stickyioOrderData) {
            for (i = 0; i < stickyioOrders.length; i++) {
                var orderChange = false;
                var thisSFCCOrder = stickyioOrders[i];
                for (j = 0; j < thisSFCCOrder.shipments.length; j++) {
                    thisShipment = thisSFCCOrder.shipments[j];
                    for (k = 0; k < Object.keys(stickyioOrderData.data).length; k++) {
                        var thisStickyioOrder = stickyioOrderData.data[[Object.keys(stickyioOrderData.data)[k]]];
                        if (thisStickyioOrder.tracking_number !== '') {
                            if (thisShipment.stickyioOrderNo === thisStickyioOrder.order_id) {
                                if (stickyio.updateSFCCShipping(OrderMgr.getOrder(thisSFCCOrder.orderNo, thisSFCCOrder.orderToken), thisShipment.id, thisStickyioOrder.tracking_number)) {
                                    thisShipment.tracking_number = thisStickyioOrder.tracking_number;
                                    orderChange = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (orderChange) {
                    stickyio.orderShippingUpdate(thisSFCCOrder.orderNo, thisSFCCOrder.orderToken); // update the order's shipping status
                    thisSFCCOrder.status = OrderMgr.getOrder(thisSFCCOrder.orderNo, thisSFCCOrder.orderToken).getShippingStatus().displayValue;
                    changedOrders.push(thisSFCCOrder);
                }
            }
        }
        var content = '';
        if (changedOrders.length > 0) {
            content = changedOrders.length + ' Updated Orders\n';
            content += JSON.stringify(changedOrders, null, '\t');
            if (parameters['Email Log'] && parameters['Email Address'] !== '') {
                stickyio.sendNotificationEmail(parameters['Email Address'].toString(), content, 'Order Update Log');
            }
        }
    }
};

exports.orderUpdateSFCCtoStickyio = function (parameters) {
    var stickyioOrders = [];
    var stickyioOrderNumbers = [];
    var changedOrders = [];
    var stickyioOrderData = false;
    var thisShipment = {};
    var i;
    var j;
    var k;
    var orders = OrderMgr.searchOrders('custom.stickyioOrder = {0}', 'creationDate asc', true);
    while (orders.hasNext()) {
        var order = orders.next();
        var thisOrderObject = {};
        thisOrderObject.orderNo = order.orderNo;
        thisOrderObject.orderToken = order.orderToken;
        thisOrderObject.shipments = [];
        var orderShipments = order.getShipments();
        for (i = 0; i < orderShipments.length; i++) {
            thisShipment = {};
            if (orderShipments[i].custom.stickyioOrderNo && !orderShipments[i].custom.stickyioOrderUpdated) {
                thisShipment.id = orderShipments[i].ID;
                var thisStickyioOrderNo = stickyio.updateStickyioOrderDetails(orderShipments[i].custom.stickyioOrderNo, orderShipments[i]);
                thisShipment.stickyioOrderNo = thisStickyioOrderNo;
                thisShipment.trackingNumber = orderShipments[i].getTrackingNumber();
                stickyioOrderNumbers.push(thisStickyioOrderNo);
                thisOrderObject.shipments.push(thisShipment);
            }
        }
        if (thisOrderObject.shipments.length > 0) { stickyioOrders.push(thisOrderObject); }
    }
    if (stickyioOrders.length > 0 && stickyioOrderNumbers.length > 0) {
        stickyioOrderData = stickyio.getOrders(stickyioOrderNumbers);
        if (stickyioOrderData) {
            for (i = 0; i < stickyioOrders.length; i++) {
                var orderChange = false;
                var thisSFCCOrder = stickyioOrders[i];
                for (j = 0; j < thisSFCCOrder.shipments.length; j++) {
                    thisShipment = thisSFCCOrder.shipments[j];
                    for (k = 0; k < Object.keys(stickyioOrderData.data).length; k++) {
                        var thisStickyioOrder = stickyioOrderData.data[[Object.keys(stickyioOrderData.data)[k]]];
                        if (thisShipment.stickyioOrderNo === thisStickyioOrder.order_id) {
                            if (stickyio.updateStickyioShipping(thisShipment.stickyioOrderNo, thisShipment.trackingNumber)) {
                                if (stickyio.shipmentUpdate(OrderMgr.getOrder(thisSFCCOrder.orderNo, thisSFCCOrder.orderToken).getShipment(thisShipment.id), thisSFCCOrder.orderNo)) { // update the shipment to be sticky.io complete)
                                    orderChange = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (orderChange) { changedOrders.push(thisSFCCOrder); }
            }
        }
        var content = '';
        if (changedOrders.length > 0) {
            content = changedOrders.length + ' Updated Orders\n';
            content += JSON.stringify(changedOrders, null, '\t');
            if (parameters['Email Log'] && parameters['Email Address'] !== '') {
                stickyio.sendNotificationEmail(parameters['Email Address'].toString(), content, 'Order Update Log');
            }
        }
    }
};
