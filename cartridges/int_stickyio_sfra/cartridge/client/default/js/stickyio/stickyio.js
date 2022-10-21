/**
 * Main client-side javascript functions for enforcing
 * subscription options, validation, and add-to-cart methods.
 * In-line console methods remain (commented out) for debugging purposes.
 */

'use strict';
var stickyioProductData = {};

var stickyio = {
    disableAddToCart: function (product, container) {
        // if this page has a subscription item and an option of offers, don't allow the Add to Cart button to be automatically enabled
        var closestWrapperPID = container.attr('data-wrapperpid');
        stickyioProductData = stickyio.getProductData(closestWrapperPID);
        // console.log(closestWrapperPID, stickyioProductData);
        if (stickyioProductData.stickyioSubscriptionActive === true) {
            // console.log('found subscription product (' + stickyioProductData.pid + '), with consumer-selectable offer', stickyioProductData);
            if (
                (stickyioProductData.stickyioOID === 'null' ||
                stickyioProductData.stickyioOID === '0' ||
                stickyioProductData.stickyioBMID === 'null' ||
                stickyioProductData.stickyioBMID === '0') ||
                (stickyioProductData.productType === 'variant' &&
                stickyioProductData.stickyioVID === 'null') ||
                (stickyioProductData.offerType === 'prepaid' &&
                (stickyioProductData.stickyioTID === '0' ||
                stickyioProductData.stickyioTID === 'null'))
            ) {
                $('button.add-to-cart[data-sfccpid="' + closestWrapperPID + '"]').attr('disabled', true);
                $('button.add-to-cart-global[data-sfccpid="' + closestWrapperPID + '"]').attr('disabled', true);
                $('button.update-cart-product-global[data-sfccpid="' + closestWrapperPID + '"]').attr('disabled', true);
                // console.log('disabling add to cart button');
            } else if (product) {
                // console.log('enabling add to cart button');
                $('button.add-to-cart, button.add-to-cart-global, button.update-cart-product-global').trigger('product:updateAddToCart', {
                    product: product, $productContainer: $(this)
                }).trigger('product:statusUpdate', product);
            }
            if (stickyioProductData.productType === 'master') {
                $('.stickyiosubscription[data-sfccpid="' + closestWrapperPID + '"] input').prop('disabled', true);
                $('.stickyiosubscription[data-sfccpid="' + closestWrapperPID + '"] select').prop('disabled', true);
            }
        }
        // console.log('found subscription product (' + stickyioProductData.pid + ')');
    },
    getProductData: function (pid, callback) {
        stickyioProductData = {};
        var stickyioProductWrapper;
        stickyioProductWrapper = $('[data-wrapperpid="' + pid + '"]');
        if (stickyioProductWrapper.length > 1) { stickyioProductWrapper = $(stickyioProductWrapper[stickyioProductWrapper.length - 1]); }
        stickyioProductData.pid = stickyioProductWrapper.attr('data-sfccpid');
        stickyioProductData.stickyioSubscriptionActive = stickyioProductWrapper.data('stickyiosubscriptionactive');
        stickyioProductData.productType = stickyioProductWrapper.attr('data-producttype');
        stickyioProductData.offerType = stickyioProductWrapper.attr('data-offertype');
        stickyioProductData.stickyioPID = stickyioProductWrapper.attr('data-stickyiopid');
        stickyioProductData.stickyioCID = stickyioProductWrapper.attr('data-stickyiocid');
        stickyioProductData.stickyioOID = stickyioProductWrapper.attr('data-stickyiooid');
        stickyioProductData.stickyioTID = stickyioProductWrapper.attr('data-stickyiotid');
        stickyioProductData.stickyioBMID = stickyioProductWrapper.attr('data-stickyiobmid');
        stickyioProductData.stickyioVID = stickyioProductWrapper.attr('data-stickyiovid');
        stickyioProductData.stickyioBillingModelConsumerSelectable = stickyioProductWrapper.data('stickyiobillingmodelconsumerselectable');
        var offerType = stickyioProductData.offerType && stickyioProductData.offerType !== 'null' ? ' (' + stickyioProductData.offerType + ')' : '';
        var selectedBillingModelDetails = [];
        var activeSelect = $('[data-wrapperpid="' + pid + '"] [data-oid="' + stickyioProductData.stickyioOID + '"] .subscriptionselect:checked');
        activeSelect = activeSelect[activeSelect.length - 1];
        if ($(':not(".select-hiddenselect") option:checked', $('[data-wrapperpid="' + pid + '"] [data-oid="' + stickyioProductData.stickyioOID + '"] .subscriptionselect:checked').parent()).length > 0) {
            $(':not(".select-hiddenselect") option:checked', $(activeSelect).parent()).each(function (index, obj) {
                selectedBillingModelDetails.push($(obj).text().trim());
            });
        } else {
            $('.stickyioproductbillingmodeldetails', $(activeSelect).parent()).each(function (index, obj) {
                selectedBillingModelDetails.push($(obj).text().trim());
            });
        }
        stickyioProductData.stickyioSelectedBillingModelDetails = selectedBillingModelDetails.join(' - ') + offerType;
        if (callback) { callback(stickyioProductData); }
        return stickyioProductData;
    },
    getClosestWrapper: function (object, context) {
        var thisContext = context;
        if (thisContext === true) { thisContext = ' .stickyiosubscription'; } else { thisContext = ''; }
        var $thisWrapper;
        if ($('.product-detail.product-wrapper').length === 0) { // we're dealing with a set
            $thisWrapper = object.closest('.product-detail.set-item' + thisContext);
            if (typeof ($thisWrapper) === 'undefined' || $thisWrapper.length === 0) {
                $thisWrapper = object.find('.product-detail.set-item' + thisContext);
            }
        } else { // not a set!
            $thisWrapper = object.closest('.quick-view-dialog' + thisContext); // check for quick-view first
            if ($thisWrapper.length > 0) {
                $thisWrapper = $thisWrapper.find('.product-detail.product-wrapper' + thisContext); // get the child
            } else { // not a quick-view
                $thisWrapper = object.closest('.product-detail.product-wrapper' + thisContext); // look for parents next
                if (typeof ($thisWrapper) === 'undefined' || $thisWrapper.length === 0) {
                    $thisWrapper = object.find('.product-detail.product-wrapper' + thisContext); // look for children
                }
            }
        }
        return $thisWrapper;
    },
    updateAddToCartStickyio: function (response) {
        var thisResponse = response;
        if ($('.stickyiosubscription').length > 0) {
            var closestWrapperPID;
            var quickView = false;
            var editProductModal = false;
            var dialog;
            if ($('#quickViewModal').length > 0 && $('#quickViewModal').is(':visible')) { quickView = true; dialog = $('#quickViewModal'); }
            if ($('#editProductModal').length > 0 && $('#editProductModal').is(':visible')) { editProductModal = true; dialog = $('#editProductModal'); }
            if (editProductModal) { // editProductModal
                closestWrapperPID = $('[data-sfccpid="' + thisResponse.data.product.id + '"] .stickyiosubscription').attr('data-wrapperpid');
            }
            if (typeof (closestWrapperPID) === 'undefined') {
                closestWrapperPID = $('[data-sfccpid="' + thisResponse.data.product.id + '"]', $(thisResponse.container)).attr('data-wrapperpid');
            }
            stickyio.getProductData(closestWrapperPID, function (thisStickyioProductData) {
                if (thisStickyioProductData.stickyioSubscriptionActive === true) {
                    if (
                        (thisStickyioProductData.stickyioCID !== 'null' &&
                        thisStickyioProductData.stickyioPID !== 'null' &&
                        thisStickyioProductData.stickyioOID !== 'null' &&
                        thisStickyioProductData.stickyioOID !== '0' &&
                        thisStickyioProductData.stickyioBMID !== 'null' &&
                        thisStickyioProductData.stickyioBMID !== '0' &&
                        thisStickyioProductData.offerType !== 'prepaid') ||
                        (thisStickyioProductData.offerType === 'prepaid' &&
                        thisStickyioProductData.stickyioTID !== 'null' &&
                        thisStickyioProductData.stickyioTID !== '0' &&
                        thisStickyioProductData.stickyioOID !== 'null' &&
                        thisStickyioProductData.stickyioOID !== '0' &&
                        thisStickyioProductData.stickyioBMID !== 'null' &&
                        thisStickyioProductData.stickyioBMID !== '0')
                        ) { // this is a stickyio subscription Product and has a PID or it's a subscription variation and has both a PID and a VID
                        if (thisStickyioProductData.productType !== 'product' && (thisStickyioProductData.productType === 'variant' && thisStickyioProductData.stickyioVID === 'null')) {
                            if (quickView || editProductModal) { $('.global-availability', dialog).data('ready-to-order', false); }
                            thisResponse.data.product.readyToOrder = false;
                        }
                    } else {
                        if (quickView || editProductModal) { $('.global-availability', dialog).data('ready-to-order', false); }
                        thisResponse.data.product.readyToOrder = false;
                    }
                    if (stickyioProductData.productType === 'master') {
                        $('.stickyiosubscription input', stickyio.getClosestWrapper($('[data-wrapperpid="' + closestWrapperPID + '"]'))).prop('disabled', true);
                        $('.stickyiosubscription select', stickyio.getClosestWrapper($('[data-wrapperpid="' + closestWrapperPID + '"]'))).prop('disabled', true);
                    }
                    // console.log('thisResponse.data.product.readyToOrder: ' + thisResponse.data.product.readyToOrder);

                    // update local add to cart
                    $('button.add-to-cart', stickyio.getClosestWrapper($('[data-wrapperpid="' + closestWrapperPID + '"]'))).attr('disabled',
                        (!thisResponse.data.product.readyToOrder || !thisResponse.data.product.available));

                    if (quickView || editProductModal) {
                        // quickview
                        $('.add-to-cart-global', dialog).attr('disabled',
                            !$('.global-availability', dialog).data('ready-to-order')
                            || !$('.global-availability', dialog).data('available')
                        );
                        // cart
                        $('.update-cart-product-global', dialog).attr('disabled',
                            !$('.global-availability', dialog).data('ready-to-order')
                            || !$('.global-availability', dialog).data('available')
                        );
                    }
                }
            });
        }
    }
};

$(function () {
    if ($('.stickyiosubscription', $('body')).length > 0) {
        $('.stickyiosubscription', $('body')).each(function () {
            stickyio.disableAddToCart(null, $(this));
        });
    }
    // else { console.log('No subscription product(s) found'); }
});

$('body').on('updateAddToCartFormData', function (e, data) {
    var thisData = data;
    var closestWrapper;
    var closestWrapperPID;
    if ($('.stickyiosubscription').length > 0) {
        if (typeof (thisData.pidsObj) === 'undefined') { // single product
            closestWrapper = stickyio.getClosestWrapper($(e.target));
            closestWrapperPID = $('.stickyiosubscription', closestWrapper).attr('data-wrapperpid');
            stickyioProductData = stickyio.getProductData(closestWrapperPID);
            if (stickyioProductData.stickyioPID) {
                thisData.offerType = stickyioProductData.offerType;
                thisData.stickyioProductID = Number(stickyioProductData.stickyioPID);
                thisData.stickyioVariationID = stickyioProductData.stickyioVID !== '0' && stickyioProductData.stickyioVID !== 'null' ? Number(stickyioProductData.stickyioVID) : null;
                thisData.stickyioCampaignID = Number(stickyioProductData.stickyioCID);
                thisData.stickyioOfferID = Number(stickyioProductData.stickyioOID);
                thisData.stickyioTermsID = stickyioProductData.stickyioTID;
                thisData.stickyioBillingModelID = Number(stickyioProductData.stickyioBMID);
                thisData.stickyioBillingModelDetails = stickyioProductData.stickyioSelectedBillingModelDetails;
            }
        } else { // product set
            var pids = JSON.parse(thisData.pidsObj);
            var i;
            for (i = 0; i < pids.length; i++) {
                if ($('[data-sfccpid="' + pids[i].pid + '"]').length > 1) {
                    closestWrapperPID = $('[data-sfccpid="' + pids[i].pid + '"] .stickyiosubscription').attr('data-wrapperpid');
                } else {
                    closestWrapperPID = $('[data-sfccpid="' + pids[i].pid + '"]').attr('data-wrapperpid');
                }
                stickyioProductData = stickyio.getProductData(closestWrapperPID);
                if (stickyioProductData.stickyioPID) {
                    pids[i].offerType = stickyioProductData.offerType;
                    pids[i].stickyioProductID = Number(stickyioProductData.stickyioPID);
                    pids[i].stickyioVariationID = stickyioProductData.stickyioVID !== '0' && stickyioProductData.stickyioVID !== 'null' ? Number(stickyioProductData.stickyioVID) : null;
                    pids[i].stickyioCampaignID = Number(stickyioProductData.stickyioCID);
                    pids[i].stickyioOfferID = Number(stickyioProductData.stickyioOID);
                    pids[i].stickyioTermsID = stickyioProductData.stickyioTID;
                    pids[i].stickyioBillingModelID = Number(stickyioProductData.stickyioBMID);
                    pids[i].stickyioBillingModelDetails = stickyioProductData.stickyioSelectedBillingModelDetails;
                }
            }
            thisData.pidsObj = JSON.stringify(pids);
        }
    }
});

$('body').on('product:afterAttributeSelect', function (e, response) { // update stickyio product if necessary
    if (typeof (response.data.product) !== 'undefined' && response.data.product.stickyioHTML) {
        $(response.container).find('.stickyiosubscriptioncontainer').empty().html(response.data.product.stickyioHTML);
        // console.log('product:afterAttributeSelect', response);
        stickyio.updateAddToCartStickyio(response);
    } else {
        $(response.container).find('.stickyiosubscriptioncontainer').empty().html('');
    }
});

/*
This mechanism to make the radio buttons respond to being clicked and updating product data is a horrible hack and, honestly, I'm embarassed about it.
What *should* happen is the product/base.js's selectAttribute method is overriden with a new selector to allow the same behavior, but I cannot figure out
how to export that function cleanly and then overwrite. SFRA is a mess! So, in order to make this work, we have hidden select dropdowns on the PDP that
are programmatically changed when a radio button/label is clicked, and then THAT fires the selectAttribute method. If you know how to cleanly export and
override a SFRA javascript method, without cloning an entire tree of js files, please get in touch so we can do away with this awfulness.
*/
$('body').on('change', '.subscriptionselect', function () { // register radio button changes
    $('.select-hiddenselect :nth-child(2)', $(this).parent()).prop('selected', true).trigger('change');
});

$('body').on('quickview:ready', function () {
    if ($('.stickyiosubscription').length > 0) {
        stickyio.getClosestWrapper($('body'), true).each(function () {
            stickyio.disableAddToCart(null, $(this));
        });
    }
});

$('body').on('editproductmodal:ready', function () {
    if ($('.stickyiosubscription').length > 0) {
        stickyio.disableAddToCart(null, stickyio.getClosestWrapper($('body'), true));
    }
});
