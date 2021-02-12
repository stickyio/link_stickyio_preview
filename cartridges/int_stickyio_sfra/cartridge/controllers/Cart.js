/**
 * AddProduct and EditProductLineItem are full "replacements" (prepends that override normal behavior) to include extended productLineItemModel details since sticky.io billing models are not actually "variations" on a product
*/

'use strict';

var server = require('server');
server.extend(module.superModule);

var stickyioEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('stickyioEnabled');

if (stickyioEnabled) {
    server.prepend('AddProduct', function (req, res) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Resource = require('dw/web/Resource');
        var URLUtils = require('dw/web/URLUtils');
        var Transaction = require('dw/system/Transaction');
        var CartModel = require('*/cartridge/models/cart');
        var ProductLineItemsModel = require('*/cartridge/models/productLineItems');
        var cartHelper = require('~/cartridge/scripts/cart/cartHelpers');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

        var currentBasket = BasketMgr.getCurrentOrNewBasket();
        var previousBonusDiscountLineItems = currentBasket.getBonusDiscountLineItems();
        var productId = req.form.pid;
        var stickyioProductID = req.form.stickyioProductID;
        var stickyioVariationID = req.form.stickyioVariationID;
        var stickyioCampaignID = req.form.stickyioCampaignID;
        var stickyioOfferID = req.form.stickyioOfferID;
        var stickyioBillingModelID = req.form.stickyioBillingModelID;
        var stickyioBillingModelDetails = req.form.stickyioBillingModelDetails;
        var childProducts = Object.hasOwnProperty.call(req.form, 'childProducts')
            ? JSON.parse(req.form.childProducts)
            : [];
        var options = req.form.options ? JSON.parse(req.form.options) : [];
        var quantity;
        var result;
        var pidsObj;

        if (currentBasket) {
            Transaction.wrap(function () {
                if (!req.form.pidsObj) {
                    quantity = parseInt(req.form.quantity, 10);
                    result = cartHelper.addProductToCart(
                        currentBasket,
                        productId,
                        quantity,
                        childProducts,
                        options,
                        stickyioProductID,
                        stickyioVariationID,
                        stickyioCampaignID,
                        stickyioOfferID,
                        stickyioBillingModelID,
                        stickyioBillingModelDetails
                    );
                } else {
                    // product set
                    pidsObj = JSON.parse(req.form.pidsObj);
                    result = {
                        error: false,
                        message: Resource.msg('text.alert.addedtobasket', 'product', null)
                    };

                    pidsObj.forEach(function (PIDObj) {
                        quantity = parseInt(PIDObj.qty, 10);
                        var pidOptions = PIDObj.options ? JSON.parse(PIDObj.options) : {};
                        var PIDObjResult = cartHelper.addProductToCart(
                            currentBasket,
                            PIDObj.pid,
                            quantity,
                            childProducts,
                            pidOptions,
                            PIDObj.stickyioProductID,
                            PIDObj.stickyioVariationID,
                            PIDObj.stickyioCampaignID,
                            PIDObj.stickyioOfferID,
                            PIDObj.stickyioBillingModelID,
                            PIDObj.stickyioBillingModelDetails
                        );
                        if (PIDObjResult.error) {
                            result.error = PIDObjResult.error;
                            result.message = PIDObjResult.message;
                        }
                    });
                }
                if (!result.error) {
                    cartHelper.ensureAllShipmentsHaveMethods(currentBasket);
                    basketCalculationHelpers.calculateTotals(currentBasket);
                }
            });
        }

        var quantityTotal = ProductLineItemsModel.getTotalQuantity(currentBasket.productLineItems);
        var cartModel = new CartModel(currentBasket);

        var urlObject = {
            url: URLUtils.url('Cart-ChooseBonusProducts').toString(),
            configureProductstUrl: URLUtils.url('Product-ShowBonusProducts').toString(),
            addToCartUrl: URLUtils.url('Cart-AddBonusProducts').toString()
        };

        var newBonusDiscountLineItem =
            cartHelper.getNewBonusDiscountLineItem(
                currentBasket,
                previousBonusDiscountLineItems,
                urlObject,
                result.uuid
            );
        if (newBonusDiscountLineItem) {
            var allLineItems = currentBasket.allProductLineItems;
            var collections = require('*/cartridge/scripts/util/collections');
            collections.forEach(allLineItems, function (pli) {
                if (pli.UUID === result.uuid) {
                    Transaction.wrap(function () {
                        pli.custom.bonusProductLineItemUUID = 'bonus'; // eslint-disable-line no-param-reassign
                        pli.custom.preOrderUUID = pli.UUID; // eslint-disable-line no-param-reassign
                    });
                }
            });
        }

        var reportingURL = cartHelper.getReportingUrlAddToCart(currentBasket, result.error);

        res.json({
            reportingURL: reportingURL,
            quantityTotal: quantityTotal,
            message: result.message,
            cart: cartModel,
            newBonusDiscountLineItem: newBonusDiscountLineItem || {},
            error: result.error,
            pliUUID: result.uuid,
            minicartCountOfItems: Resource.msgf('minicart.count', 'common', null, quantityTotal),
            stickyioProductID: stickyioProductID,
            stickyioVariationID: stickyioVariationID,
            stickyioCampaignID: stickyioCampaignID,
            stickyioOfferID: stickyioOfferID,
            stickyioBillingModelID: stickyioBillingModelID,
            stickyioBillingModelDetails: stickyioBillingModelDetails
        });

        this.emit('route:Complete', req, res);
    });

    server.append('GetProduct', function (req, res, next) { // get the custom stickyio PLI attributes
        var BasketMgr = require('dw/order/BasketMgr');
        var URLUtils = require('dw/web/URLUtils');

        var viewData = res.getViewData();
        var requestUuid = req.querystring.uuid;

        var basket = BasketMgr.getCurrentOrNewBasket();
        var plis = basket.getAllProductLineItems();
        var i;
        for (i = 0; i < plis.length; i++) {
            if (plis[i].UUID === requestUuid) {
                viewData.product.stickyio.stickyioBMID = plis[i].custom.stickyioBillingModelID;
                viewData.product.stickyio.stickyioBaseURL = URLUtils.url('Product-Variation', 'pid', plis[i].productID, 'quantity', plis[i].quantity);
            }
        }

        res.setViewData(viewData);
        return next();
    });

    server.prepend('EditProductLineItem', function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var ProductMgr = require('dw/catalog/ProductMgr');
        var Resource = require('dw/web/Resource');
        var URLUtils = require('dw/web/URLUtils');
        var Transaction = require('dw/system/Transaction');
        var CartModel = require('*/cartridge/models/cart');
        var collections = require('*/cartridge/scripts/util/collections');
        var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

        var currentBasket = BasketMgr.getCurrentBasket();

        if (!currentBasket) {
            res.setStatusCode(500);
            res.json({
                error: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            this.emit('route:Complete', req, res);
            return next();
        }

        var uuid = req.form.uuid;
        var productId = req.form.pid;
        var selectedOptionValueId = req.form.selectedOptionValueId;
        var updateQuantity = parseInt(req.form.quantity, 10);
        var stickyioProductID = req.form.stickyioProductID;
        var stickyioVariationID = req.form.stickyioVariationID;
        var stickyioCampaignID = req.form.stickyioCampaignID;
        var stickyioOfferID = req.form.stickyioOfferID;
        var stickyioBillingModelID = req.form.stickyioBillingModelID;
        var stickyioBillingModelDetails = req.form.stickyioBillingModelDetails;

        var productLineItems = currentBasket.allProductLineItems;
        var requestLineItem = collections.find(productLineItems, function (item) {
            return item.UUID === uuid;
        });

        var uuidToBeDeleted = null;
        var pliToBeDeleted;
        var newPidAlreadyExist = collections.find(productLineItems, function (item) {
            if (item.productID === productId && item.UUID !== uuid && item.custom.stickyioCampaignID !== stickyioCampaignID && item.custom.stickyioOfferID !== stickyioOfferID && item.custom.stickyioBillingModelID !== stickyioBillingModelID) {
                uuidToBeDeleted = item.UUID;
                pliToBeDeleted = item;
                updateQuantity += parseInt(item.quantity, 10);
                return true;
            }
            return false;
        });

        var availableToSell = 0;
        var totalQtyRequested = 0;
        var qtyAlreadyInCart = 0;
        var minOrderQuantity = 0;
        var canBeUpdated = false;
        var perpetual = false;
        var bundleItems;

        if (requestLineItem) {
            if (requestLineItem.product.bundle) {
                bundleItems = requestLineItem.bundledProductLineItems;
                canBeUpdated = collections.every(bundleItems, function (item) {
                    var quantityToUpdate = updateQuantity *
                        requestLineItem.product.getBundledProductQuantity(item.product).value;
                    qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                        item.productID,
                        productLineItems,
                        item.UUID
                    );
                    totalQtyRequested = quantityToUpdate + qtyAlreadyInCart;
                    availableToSell = item.product.availabilityModel.inventoryRecord.ATS.value;
                    perpetual = item.product.availabilityModel.inventoryRecord.perpetual;
                    minOrderQuantity = item.product.minOrderQuantity.value;
                    return (totalQtyRequested <= availableToSell || perpetual) &&
                        (quantityToUpdate >= minOrderQuantity);
                });
            } else {
                availableToSell = requestLineItem.product.availabilityModel.inventoryRecord.ATS.value;
                perpetual = requestLineItem.product.availabilityModel.inventoryRecord.perpetual;
                qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                    productId,
                    productLineItems,
                    requestLineItem.UUID
                );
                totalQtyRequested = updateQuantity + qtyAlreadyInCart;
                minOrderQuantity = requestLineItem.product.minOrderQuantity.value;
                canBeUpdated = (totalQtyRequested <= availableToSell || perpetual) &&
                    (updateQuantity >= minOrderQuantity);
            }
        }

        var error = false;
        if (canBeUpdated) {
            var product = ProductMgr.getProduct(productId);
            try {
                Transaction.wrap(function () {
                    if (newPidAlreadyExist) {
                        var shipmentToRemove = pliToBeDeleted.shipment;
                        currentBasket.removeProductLineItem(pliToBeDeleted);
                        if (shipmentToRemove.productLineItems.empty && !shipmentToRemove.default) {
                            currentBasket.removeShipment(shipmentToRemove);
                        }
                    }

                    if (!requestLineItem.product.bundle) {
                        requestLineItem.replaceProduct(product);
                    }

                    // If the product has options
                    var optionModel = product.getOptionModel();
                    if (optionModel && optionModel.options && optionModel.options.length) {
                        var productOption = optionModel.options.iterator().next();
                        var productOptionValue = optionModel.getOptionValue(productOption, selectedOptionValueId);
                        var optionProductLineItems = requestLineItem.getOptionProductLineItems();
                        var optionProductLineItem = optionProductLineItems.iterator().next();
                        optionProductLineItem.updateOptionValue(productOptionValue);
                    }
                    requestLineItem.custom.stickyioProductID = Number(stickyioProductID);
                    requestLineItem.custom.stickyioVariationID = Number(stickyioVariationID);
                    requestLineItem.custom.stickyioCampaignID = Number(stickyioCampaignID);
                    requestLineItem.custom.stickyioOfferID = Number(stickyioOfferID);
                    requestLineItem.custom.stickyioBillingModelID = Number(stickyioBillingModelID);
                    requestLineItem.custom.stickyioBillingModelDetails = stickyioBillingModelDetails;

                    requestLineItem.setQuantityValue(updateQuantity);
                    basketCalculationHelpers.calculateTotals(currentBasket);
                });
            } catch (e) {
                error = true;
            }
        }

        if (!error && requestLineItem && canBeUpdated) {
            var cartModel = new CartModel(currentBasket);

            var responseObject = {
                cartModel: cartModel,
                newProductId: productId
            };

            if (uuidToBeDeleted) {
                responseObject.uuidToBeDeleted = uuidToBeDeleted;
            }

            res.json(responseObject);
        } else {
            res.setStatusCode(500);
            res.json({
                errorMessage: Resource.msg('error.cannot.update.product', 'cart', null)
            });
        }

        this.emit('route:Complete', req, res);
        return true;
    });
}

module.exports = server.exports();
