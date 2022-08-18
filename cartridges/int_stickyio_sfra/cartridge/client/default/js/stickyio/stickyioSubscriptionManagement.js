/**
 * Client-side subscription management javascript
 */

'use strict';

var processInclude = require('base/util');
var datepickerFactory = require('jquery-datepicker');

var base = require('base/product/base');
var cleave = require('base/components/cleave');
let listJS = require('../util/list');

let productSwapData = [];
let newProductID = '';
let newProductVariantID = 0;
let currentProductID = '';
let quantity = 0;
const activeColor = '#dcf1f9';
const inactiveColor = '#e5e9ee';

datepickerFactory($);

/**
 *  reset any changed options
 * @returns {void}
 */
function reset() {
    var subscriptionID = $('#quickViewModal .stickyiocancelbutton').data('sid');
    $('.subscriptionmanagementselect, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').val(0); // reset select
    if ($('.updatebillingmodel, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').length > 0) { // reset billing model
        $('.updatebillingmodel, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').val($('.updatebillingmodel, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').data('initialvalue'));
    }
    if ($('.datepicker, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').length > 0) { // reset recurring date
        $('.datepicker, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').val($('.datepicker, .subscriptionmanagement [data-subscriptionid="' + subscriptionID + '"]').data('initialvalue'));
    }
}

/**
 * bind reset
 * @returns {void}
 */
function bindClose() {
    $('body').on('click', '.stickyiocancelbutton, .close, .modal-backdrop', function () {
        reset();
    });
}

/**
 * unbind reset
 * @returns {void}
 */
function unbindClose() {
    $('body').off('click', '.stickyiocancelbutton, .close, .modal-backdrop');
}

$('body').on('quickview:show', function () {
    $('.stickyiosubscriptionresponse').removeClass('stickyiosubmanerror')
    .removeClass('stickyiosubmansuccess')
    .text('')
    .hide();
});

$('body').on('click', '.stickyiocancelbutton, .modal-backdrop', function () { $('#quickViewModal').modal('hide'); }); // possible thanks to CSS overrides for Bootstrap's .modal class

$('body').on('click', '.stickyioconfirmbutton', function () {
    const urlParams = new URLSearchParams($(this).data('href').split('?')[1]);
    const action = urlParams.get('action');
    const cancellationRequired = urlParams.get('cancellationRequired');

    let noteText = '';
    let noteId = '';
    let isOk = true;

    if (cancellationRequired === 'true' && (action === 'cancel' || action === 'terminate_next')) {
        noteText = $('#cancellation_note').val();
        noteId = $("#select_notetype_id option:selected").attr("id");

        if (parseInt(noteId) === 0) {
            $('#warning_message').text('Please select a Cancellation Reason');
            isOk = false;
        }
    }
    
    let url = $(this).data('href') + '&noteid=' + noteId + '&note=' + noteText;

    if (isOk) {
        $(this).attr('disabled', true);
        $('.stickyiocancelbutton').attr('disabled', true);
        $('.close').attr('disabled', true);
        unbindClose();
        $.ajax({
            url: url,
            method: 'GET',
            success: function (data) {
                if (data.redirectURL) {
                    window.location = data.redirectURL;
                } else {
                    $('.stickyiosubscriptionresponse').addClass(data.error ? 'stickyiosubmanerror' : 'stickyiosubmansuccess').text(data.message).show();
                    bindClose();
                    reset();
                    $('#quickViewModal').modal('hide');
                }
            }
        });
    }
});

$('body').on('click', '.stickyAddressShow', function () {
    $('.stickyioSubscriptionResponse').removeClass('stickyiosubmansuccess','stickyiosubmanerror').text('').hide();
});
$('body').on('click', '.stickyCreditCardShow', function () {
    $('.stickyioPaymentResponse').removeClass('stickyiosubmansuccess','stickyiosubmanerror').text('').hide();
});

$('.stickyAddressForm').on('submit', function (e) {
    e.preventDefault();
	
    $.ajax({
        url: $(this).attr('action'),
        method: 'POST',
        data: $(this).serialize(),
        dataType: 'json',
        success: function (data) {
            $('.stickyioSubscriptionResponse').addClass(data.success ? 'stickyiosubmansuccess' : 'stickyiosubmanerror').text(data.message).show();
        }
    });
});

$('.stickyPaymentForm').on('submit', function (e) {
    e.preventDefault();
	
    $.ajax({
        url: $(this).attr('action'),
        method: 'POST',
        data: $(this).serialize(),
        dataType: 'json',
        success: function (data) {
            $('.stickyioPaymentResponse').addClass(data.success ? 'stickyiosubmansuccess' : 'stickyiosubmanerror').text(data.message).show();
        }
    });
});

$(document).ready(function () {
    if ($('.subscriptionmanagement', $('body')).length > 0) {
        processInclude(require('./stickyioQuickView'));
        $('.subscriptionmanagement', $('body')).each(function () {
            // Safari on macOS doesn't support the native HTML5 date picker (and iOS has incomplete support),
            // so we need a different control. We're shipping with jQueryUI's datepicker as a stand-alone
            // node module (jquery-datepicker), so it should be easy to replace if it doesn't fit your needs.
            var thisDateInput = $('.datepicker', this);
            if (thisDateInput.length > 0) {
                var recurringDate = thisDateInput.val();
                thisDateInput.datepicker({ // initialize jQueryUI datepicker
                    minDate: 0, // can't be less than today
                    dateFormat: 'yy-mm-dd',
                    onClose: function (selectedDate) {
                        if (recurringDate !== selectedDate) {
                            var thisURL = $(this).data('href');
                            thisURL = thisURL.replace(/&date=[0-9]{4}-[0-9]{2}-[0-9]{2}/, ''); // strip any existing date params
                            $(this).data('href', thisURL += '&date=' + $(this).val());
                            $(this).trigger('datepickchange');
                        }
                    }
                });
            }
        });
        if ($('.stickyiosubscriptionresponse').text()) {
            $('.stickyiosubscriptionresponse').addClass('stickyiosubmansuccess').show();
        }
        cleave.handleCreditCardNumber('.cardNumber', '#cardType'); 
        bindClose();
    }
});

// Cancellation note selector
$('body').on('change', '.select-notetype', function () {
    let selectedNoteText = $(this).children(":selected").text();
    let selectedNoteEditable = $(this).val();
    $('#warning_message').text('');

    $('#cancellation_note').val(selectedNoteText);

    if (parseInt(selectedNoteEditable) == 0) {
        $('#cancellation_note').css('background-color', '#D1D1D1');
        $('#cancellation_note').prop('readonly', true);
    } else {
        $('#cancellation_note').css('background-color', '#FFFFFF');
        $('#cancellation_note').prop('readonly', false);
    }
    
});

/**
 * Generates the modal window on the first call.
 *
 */
function getModalHtmlElement() {
    if ($('#productSwapModal').length !== 0) {
        $('#productSwapModal').remove();
    }
    let htmlString = '<!-- Modal -->'
        + '<div class="modal fade" id="productSwapModal" tabindex="-1" role="dialog">'
        + '<span class="enter-message sr-only" ></span>'
        + '<div class="modal-dialog quick-view-dialog">'
        + '<!-- Modal content-->'
        + '<div class="modal-content">'
        + '<div class="modal-header">'
        + '    <button type="button" class="close pull-right" data-dismiss="modal">'
        + '        <span aria-hidden="true">&times;</span>'
        + '        <span class="sr-only"> </span>'
        + '    </button>'
        + '</div>'
        + '<div class="modal-body"></div>'
        + '<div class="modal-footer"></div>'
        + '</div>'
        + '</div>'
        + '</div>';
    $('body').append(htmlString);
}

/**
 * replaces the content in the modal window for product variation to be edited.
 * @param {string} editProductUrl - url to be used to retrieve a new product model
 */
 function fillModalElement(editProductUrl, callback = null) {
    $('.modal-body').spinner().start();
    $.ajax({
        url: editProductUrl,
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            let parsedHtml = parseHtml(data.renderedTemplate);

            $('#productSwapModal .modal-body').empty();
            $('#productSwapModal .modal-body').html(parsedHtml.body);
            $('#productSwapModal .modal-footer').html(parsedHtml.footer);
            $('#productSwapModal .modal-header .close .sr-only').text(data.closeButtonText);
            $('#productSwapModal .enter-message').text(data.enterDialogMessage);
            $('#productSwapModal').modal('show');
            $('body').trigger('productSwapModal:ready');
            $.spinner().stop();

            if (callback) {
                callback();
            }
        },
        error: function () {
            $.spinner().stop();
        }
    });
}

/**
 * Parses the html for a modal window
 * @param {string} html - representing the body and footer of the modal window
 *
 * @return {Object} - Object with properties body and footer.
 */
 function parseHtml(html) {
    var $html = $('<div>').append($.parseHTML(html));

    var body = $html.find('.modal-body');
    var footer = $html.find('.modal-footer').children();

    return { body: body, footer: footer };
}

/**
 * @param {string} actionUrlF
 */
function showModal(actionUrl, e, callback = null) {
    e.preventDefault();
    $('body > .modal-backdrop').remove();

    getModalHtmlElement();
    fillModalElement(actionUrl, callback);
}

$('body').on('click', '.product-edit', function (e) {
    newProductID = '';
    quantity = 0;

    newProductID = '';
    newProductVariantID = 0;

    let actionUrl = document.getElementById("product-edit-url").getAttribute('href');
    const url = new URL('http:/' + actionUrl);
    const urlParams = new URLSearchParams(url.search);
    const productLineItem = JSON.parse(urlParams.get('productLineItem'));
    newProductVariantID = productLineItem.stickyVariantID ? productLineItem.stickyVariantID : 0;

    showModal(actionUrl, e);
});

$('body').on('click', '.continueBtn', function (e) {
    let actionUrl = document.getElementById("continue-btn").getAttribute('data-href');

    if (newProductID.length > 0) {
        actionUrl += '&newProductID=' + newProductID;
    }

    actionUrl += '&quantity=' + quantity;

    showModal(actionUrl, e);
});

function compare(a, b) {
    if (a.name < b.name){
      return -1;
    }

    if (a.name > b.name){
      return 1;
    }

    return 0;
  }

function isCurrentProduct(product) {
    return product.isCurrent === 1;
}

function loadSwapProducts() {
    productSwapData.sort(compare);

    const options = {
        valueNames: [
            'name', 
            'price',
            { data: ['id'] },
            { attr: 'src', name: 'image' },
            'isCurrent',
            'isNew'
        ],
        item: function(values) {
            let btnClass = 'btn btn-primary product_swap_btn';
            let btnText = 'Swap Product';
            let btnIcon = '';
            let bgColor = '#ffffff';

            if (values.isCurrent === 1) {
                btnText = 'Current Product';
                btnClass = 'slds-button slds-button_neutral product_swap_btn';
                btnIcon = newProductID.length > 0 ? '' : '<i class="fa fa-check"></i>&nbsp;&nbsp;';
                bgColor = newProductID.length > 0 ? inactiveColor : activeColor;
            } else if (values.isNew === 1) {
                btnText = 'New Product';
                btnClass = 'btn btn-block btn-outline-primary product_swap_btn';
                btnIcon = '<i class="fa fa-check"></i>&nbsp;&nbsp;';
                bgColor = activeColor;
            }

            return `
                <div class="col-md-4 d-flex align-items-stretch">
                    <div id="card-${values.id}" class="card mt-3" style="background-color: ${bgColor}">
                        <div class="card-header">
                            <h5 class="name" style="float: left"></h5>
                            <small class="price text-muted" style="float: right"></small>
                        </div>

                        <div class="card-body">
                            <article class="photo">
                                <div style="width:100%; text-align:center">
                                    <img class="image" src="data:," alt style="width:150px; height:150px;">
                                </div>
                            </article>
                        </div>

                        <div id="card-footer-${values.id}" class="card-footer d-flex justify-content-center" style="background-color: ${bgColor}">
                            <button id="${values.id}" class="${btnClass}">${btnIcon}${btnText}</button>
                        </div>
                    </div>
                </div>
            `
        },
        page: 6,
        pagination: true
    }

    let productSwapList = new listJS.List('product_wap_list', options);

    // Add current product to the top of the list
    let currentProductData = productSwapData.find(isCurrentProduct);

    if (currentProductData) {
        productSwapList.add({
            name: currentProductData.name,
            price: currentProductData.price,
            id: currentProductData.productId,
            image: currentProductData.imgurl,
            isCurrent: currentProductData.isCurrent,
            isNew: currentProductData.isNew
        });
    }

    // Add the other products...
    for (let i = 0; i < productSwapData.length; i++) {
        if (productSwapData[i].isCurrent === 0) {
            productSwapList.add({
                name: productSwapData[i].name,
                price: productSwapData[i].price,
                id: productSwapData[i].productId,
                image: productSwapData[i].imgurl,
                isCurrent: productSwapData[i].isCurrent,
                isNew: productSwapData[i].isNew
            });
        }
    }
}

$('body').on('click', '.swapBtn', function (e) {
    newProductID = '';
    newProductVariantID = 0;

    let actionUrl = document.getElementById("swap-btn").getAttribute('data-href');
    const url = new URL('http:/' + actionUrl);
    const urlParams = new URLSearchParams(url.search);
    const productLineItem = JSON.parse(urlParams.get('productLineItem'));
    const swapProducts = eval(urlParams.get('swapProducts'));
    productSwapData = JSON.parse(swapProducts);
    currentProductID = productLineItem.productID;
    quantity = productLineItem.quantity;

    for (let i = 0; i < productSwapData.length; i++) {
        productSwapData[i].isCurrent = productSwapData[i].productId === productLineItem.productID ? 1 : 0;
        productSwapData[i].isNew = 0;
    }

    showModal(actionUrl, e, loadSwapProducts);
});

$('body').on('click', '.previousBtn', function (e) {
    let actionUrl = document.getElementById("previous-btn").getAttribute('data-href');
    showModal(actionUrl, e, loadSwapProducts);
});

$('body').off('change', '.quantity-select').on('change', '.quantity-select', function () {
    quantity = $(this).val();
});

function toast(message) {
    let snackbar = document.getElementById("snackbar");
    snackbar.innerText = message;
    snackbar.className = "show";
   
    setTimeout(function(){ snackbar.className = snackbar.className.replace("show", ""); }, 3000);
}

$('body').on('click', '.saveBtn', function () {
    $('#productSwapModal').modal('hide');

    let actionUrl = document.getElementById("save-btn").getAttribute('data-href');

    if (newProductID.length > 0) {
        actionUrl += '&newProductID=' + newProductID;
    }

    if (newProductVariantID > 0) {
        actionUrl += '&newProductVariantID=' + newProductVariantID;
    }    

    actionUrl += '&quantity=' + quantity;

    $.ajax({
        url: actionUrl,
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            console.log('Sucessfully updating product - message = ' + data.message);
            toast(data.message);
        },
        error: function () {
            console.log('Unable to swap product');
        }
    });
});

$('body').on('click', '.product_swap_btn', function () {
    let btnIcon = '<i class="fa fa-check"></i>&nbsp;&nbsp;';
    let clickedOnCurrent = false;

    if ($(this).hasClass("slds-button_neutral")) {
        clickedOnCurrent = true;
    }

    $(".product_swap_btn").each(function (index, element) {
        if (!$(element).hasClass("slds-button_neutral")) {
            $(element).removeClass();
            $(element).addClass('btn btn-primary product_swap_btn');
            $(element).html('Swap Product');
            
            let productId = $(element).attr('id');

            $('#card-' + productId).css('background-color', '#ffffff');
            $('#card-footer-' + productId).css('background-color', '#ffffff');
        } else if (!clickedOnCurrent) {
            $(element).html('Current Product');

            $('#card-' + currentProductID).css('background-color', inactiveColor);
            $('#card-footer-' + currentProductID).css('background-color', inactiveColor);
        }
    });

    if (!clickedOnCurrent) {
        $(this).removeClass();
        $(this).addClass('btn btn-block btn-outline-primary product_swap_btn');
        $(this).html(btnIcon + 'New Product');
        newProductID = $(this).attr('id');

        $('#card-' + newProductID).css('background-color', activeColor);
        $('#card-footer-' + newProductID).css('background-color', activeColor);
    } else {
        $(this).html(btnIcon + 'Current Product');
        newProductID = '';

        $('#card-' + currentProductID).css('background-color', activeColor);
        $('#card-footer-' + currentProductID).css('background-color', activeColor);
    }

    for (let i = 0; i < productSwapData.length; i++) {
        if (productSwapData[i].productId === newProductID) {
            productSwapData[i].isNew = 1;
        } else {
            productSwapData[i].isNew = 0;
        }
    }
});

$(document).on("click", "a.page" , function() {
    if (!$(this).parent().hasClass("active")) {
        $(".product_swap_btn").each(function (index, element) {
            let productId = $(element).attr('id');

            let btnClass = 'btn btn-primary product_swap_btn';
            let btnText = 'Swap Product';
            let btnIcon = '';
            let bgColor = '#ffffff';
            let cardId = '#card-' + productId;
            let cardFooterId = '#card-footer-' + productId;

            if (productId == currentProductID) {
                btnText = 'Current Product';
                btnClass = 'slds-button slds-button_neutral product_swap_btn';
                btnIcon = newProductID.length > 0 ? '' : '<i class="fa fa-check"></i>&nbsp;&nbsp;';
                bgColor = newProductID.length > 0 ? inactiveColor : activeColor;
                cardId = '#card-' + currentProductID;
                cardFooterId = '#card-footer-' + currentProductID;
            } else if (productId == newProductID) {
                btnText = 'New Product';
                btnClass = 'btn btn-block btn-outline-primary product_swap_btn';
                btnIcon = '<i class="fa fa-check"></i>&nbsp;&nbsp;';
                bgColor = activeColor;
                cardId = '#card-' + newProductID;
                cardFooterId = '#card-footer-' + newProductID;
            }

            $(element).removeClass();
            $(element).addClass(btnClass);
            $(element).html(btnIcon + btnText);
            $(cardId).css('background-color', bgColor);
            $(cardFooterId).css('background-color', bgColor);
        });
    }
});

$('body').off('product:afterAttributeSelect').on('product:afterAttributeSelect', function (e, response) {
    newProductVariantID = response.data.product.stickyio.stickyioVID ? response.data.product.stickyio.stickyioVID : 0;
});