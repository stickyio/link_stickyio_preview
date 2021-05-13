'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var File = require('dw/io/File');
var FileWriter = require('dw/io/FileWriter');
var CSVStreamWriter = require('dw/io/CSVStreamWriter');
var headers = ['orderNo', 'orderToken', 'customerID'];

exports.orderDataExport = function (parameters) {
    var subscriptionOrders = [];
    var orders = OrderMgr.searchOrders('custom.stickyioOrder = {0}', 'creationDate asc', true);
    while (orders.hasNext()) {
        var order = orders.next();
        var thisOrderObject = {};
        thisOrderObject.orderNo = order.orderNo;
        thisOrderObject.orderToken = order.orderToken;
        thisOrderObject.customerID = order.customer.ID;
        subscriptionOrders.push(thisOrderObject);
    }
    orders.close();
    if (subscriptionOrders.length > 0) {
        var file = new File('/IMPEX/src/subscriptionOrderData.csv');
        if (!file.exists()) { file.createNewFile(); }
        var fileWriter = new FileWriter(file, 'UTF-8');
        var csv = new CSVStreamWriter(fileWriter);
        csv.writeNext(headers);
        var i;
        for (i = 0; i < subscriptionOrders.length; i++) {
            csv.writeNext(subscriptionOrders[i].orderNo, subscriptionOrders[i].orderToken, subscriptionOrders[i].customerID);
        }
        csv.close();
    }
};
