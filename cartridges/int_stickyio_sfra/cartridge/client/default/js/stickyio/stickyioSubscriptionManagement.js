/**
 * Client-side subscription management javascript
 */

'use strict';

var processInclude = require('base/util');
var datepickerFactory = require('jquery-datepicker');

var base = require('base/product/base');
var cleave = require('base/components/cleave');


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
    $(this).attr('disabled', true);
    $('.stickyiocancelbutton').attr('disabled', true);
    $('.close').attr('disabled', true);
    unbindClose();
    $.ajax({
        url: $(this).data('href'),
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
});

$('body').on('click', '.stickyAddressShow', function () {
	$('.stickyioSubscriptionResponse').removeClass('stickyiosubmansuccess','stickyiosubmanerror').text('').hide();
});
$('body').on('click', '.stickyCreditCardShow', function () {
	$('.stickyioPaymentResponse').removeClass('stickyiosubmansuccess','stickyiosubmanerror').text('').hide();
});

$('.stickyAddress-form').on('submit', function (e) {
	e.preventDefault();
	
    $.ajax({
        url: $(this).attr('action'),
        method: 'POST',
        data     : $(this).serialize(),
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
        data     : $(this).serialize(),
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
