/**
 * Custom quickView modal for handling on-change events
 * and a datepicker class when dealing with subscription management.
 */

'use strict';
var focusHelper = require('base/components/focus');

/**
 * Generates the modal window on the first call.
 *
 */
function getModalHtmlElement() {
    if ($('#quickViewModal').length !== 0) {
        $('#quickViewModal').remove();
    }
    var htmlString = '<!-- Modal -->'
        + '<div class="modal fade" id="quickViewModal" role="dialog">'
        + '<span class="enter-message sr-only" ></span>'
        + '<div class="modal-dialog quick-view-dialog">'
        + '<!-- Modal content-->'
        + '<div class="modal-content">'
        + '<div class="modal-header">'
        + '    <a class="full-pdp-link" href=""></a>'
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
 * @typedef {Object} QuickViewHtml
 * @property {string} body - Main Quick View body
 * @property {string} footer - Quick View footer content
 */

/**
 * Parse HTML code in Ajax response
 *
 * @param {string} html - Rendered HTML from quickview template
 * @return {QuickViewHtml} - QuickView content components
 */
function parseHtml(html) {
    var $html = $('<div>').append($.parseHTML(html));

    var body = $html.find('.product-quickview');
    var footer = $html.find('.modal-footer').children();

    return { body: body, footer: footer };
}

/**
 * replaces the content in the modal window on for the selected product variation.
 * @param {string} selectedValueUrl - url to be used to retrieve a new product model
 */
function fillModalElement(selectedValueUrl) {
    $('.modal-body').spinner().start();
    $.ajax({
        url: selectedValueUrl,
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            var parsedHtml = parseHtml(data.renderedTemplate);

            $('.modal-body').empty();
            $('.modal-body').html(parsedHtml.body);
            $('.modal-footer').html(parsedHtml.footer);
            $('.full-pdp-link').text(data.quickViewFullDetailMsg);
            $('#quickViewModal .full-pdp-link').replaceWith(function () {
                return $('<span />').append($(this).contents());
            });
            $('#quickViewModal .size-chart').remove();
            $('#quickViewModal .modal-header .close .sr-only').text(data.closeButtonText);
            $('#quickViewModal .enter-message').text(data.enterDialogMessage);
            $('#quickViewModal').modal('show');
            $('body').trigger('quickview:ready');

            $.spinner().stop();
        },
        error: function (data) {
            $.spinner().stop();
            if (data.responseJSON.redirectUrl) { // this is now necessary since we're using quickView for subscription management
                window.location.href = data.responseJSON.redirectUrl;
            }
        }
    });
}

module.exports = {
    showQuickviewSelect: function () { // support dropdowns trigerring quickview
        $('body').on('change', '.quickview', function (e) {
            e.preventDefault();
            var selectedValueUrl = $(':selected', this).data('href');
            $(e.target).trigger('quickview:show');
            getModalHtmlElement();
            fillModalElement(selectedValueUrl);
        });
    },
    showQuickviewDatePicker: function () { // support jquery-datepicker changes trigerring quickview
        $('.datepicker').on('datepickchange', function (e) {
            e.preventDefault();
            var selectedValueUrl = $(this).data('href');
            $(e.target).trigger('quickview:show');
            getModalHtmlElement();
            fillModalElement(selectedValueUrl);
        });
    },
    focusQuickview: function () {
        $('body').on('shown.bs.modal', '#quickViewModal', function () {
            $('#quickViewModal .close').focus();
        });
    },
    trapQuickviewFocus: function () {
        $('body').on('keydown', '#quickViewModal', function (e) {
            var focusParams = {
                event: e,
                containerSelector: '#quickViewModal',
                firstElementSelector: '.full-pdp-link',
                lastElementSelector: '.add-to-cart-global',
                nextToLastElementSelector: '.modal-footer .quantity-select'
            };
            focusHelper.setTabNextFocus(focusParams);
        });
    }
};
