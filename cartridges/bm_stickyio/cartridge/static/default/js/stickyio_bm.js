/**
 * Business Manager javascript functionality
*/

'use strict';

var stickyiocampaigns = {};
var stickyioproductcampaigndata = {};
var pid = String;

jQuery(function () {
    jQuery('.stickyiogetcampaigns').on('click', function () {
        updateCampaigns();
    });
    jQuery('.stickyioproductsearchbutton').on('click', function () {
        jQuery(this).attr('disabled', true);
        jQuery('.stickyioproducterror').text('').hide();
        jQuery('.stickyiobillingmodelerror').hide().removeClass('stickyioerror');
        jQuery('.stickyioproductbillingmodelselect').show();
        pid = jQuery('.stickyioproductsearch').val();
        if (pid !== '') {
            jQuery.ajax({
                type: 'POST',
                url: jQuery(this).attr('href'),
                data: { pid: pid },
                dataType: 'json',
                success: function (data) {
                    if (data.error) {
                        jQuery('.stickyioproducterror').show().text(data.error).addClass('stickyioerror');
                        jQuery('.stickyioproductsearchbutton').attr('disabled', false);
                    }
                    else {
                        let url = String;
                        if ((/[?|&]pid=/).match(window.location.search)) { url = window.location.href.replace(/([?|&]pid=)[^&]+/, '$1' + pid); }
                        else { url = window.location + '&pid=' + pid; }
                        window.location = url;
                    }
                }
            });
        }
    });
    jQuery('.stickyioproductselect').on('change', function () {
        let thisProductID = jQuery(this).val();
        if (thisProductID !== '0') {
            jQuery('.stickyioproductsearch').val(thisProductID);
            if (window.location.href.match(/&pid/)) {
                window.location = window.location.href.replace(/&pid=.+&?/, '&pid=' + thisProductID);
            } else { window.location = window.location + '&pid=' + thisProductID; }
        } else { jQuery('.stickyioproductsearch').val(''); }
    });
    jQuery('.stickyioproductofferselect').on('change', function () {
        jQuery('.stickyioproductbillingmodelselect').show();
        jQuery('.stickyiobillingmodelerror').hide().removeClass('stickyioerror');
        jQuery('.stickyioproductsavebutton').attr('disabled', false);
        let thisCampaign = 1;
        let thisOffer = jQuery(this).val();
        if (thisOffer !== '0') {
            jQuery('.stickyioproductbillingmodelselect').empty();
            let billingModelKeys = Object.keys(stickyiocampaigns[thisCampaign.toString()].offers[thisOffer.toString()].billing_models);
            if (billingModelKeys.length > 0) {
                if (billingModelKeys.length > 1) {
                    jQuery('.stickyioproductbillingmodelselect').append('<option value="0" disabled>' + jQuery('.stickyioproductbillingmodelselect').data('default') + '</option>');
                }
                for (let i = 0; i < billingModelKeys.length; i++) {
                    let thisBillingModel = stickyiocampaigns[thisCampaign.toString()].offers[thisOffer.toString()].billing_models[billingModelKeys[i]];
                    jQuery('.stickyioproductbillingmodelselect').append('<option value="' + thisBillingModel.id + '">' + thisBillingModel.name + '</option>');
                }
            } else {
                jQuery('.stickyioproductbillingmodelselect').hide();
                jQuery('.stickyiobillingmodelerror').show().addClass('stickyioerror');
                jQuery('.stickyioproductsavebutton').attr('disabled', true);
            }
        } else {
            jQuery('.stickyioproductbillingmodelselect').empty().append('<option value="0" disabled>' + jQuery('.stickyioproductbillingmodelselect').data('default') + '</option>');
        }
    });
    jQuery('.stickyioproductsavebutton').on('click', function () {
        jQuery('input, button, select').attr('disabled', true);
        jQuery('.stickyioproductsavestatus').hide().text('').removeClass('stickyioerror').removeClass('stickyiosuccess');
        jQuery('.stickyioproductsaving').show();
        jQuery.ajax({
            type: 'POST',
            url: jQuery(this).attr('href'),
            data: { pid: pid, cid: 1, oid: jQuery('.stickyioproductofferselect').val(), bmid: JSON.stringify(jQuery('.stickyioproductbillingmodelselect').val()), cs: jQuery('.stickyioproductallowconsumerselect').is(':checked') ? true : false },
            dataType: 'json',
            success: function (data) {
                if (data.error) {
                    jQuery('.stickyioproductsavestatus').show().text(data.error).addClass('stickyioerror');
                    jQuery('input, button, select').attr('disabled', false);
                } else {
                    jQuery('.stickyioproductsavestatus').show().text(data.result).addClass('stickyiosuccess');
                    updateCampaigns();
                }
                jQuery('.stickyioproductsaving').hide();
            }
        });
    });
    if (jQuery('.stickyioproductid').length > 0) { pid = jQuery('.stickyioproductid').data('stickyioproductid'); }
    if (pid && jQuery(".stickyioproductselect option[value='" + pid + "']").length > 0) {
        jQuery('.stickyioproductselect, .stickyioproductsearch').val(pid);
    } else { jQuery('.stickyioproductsearch').val(''); }
    if (jQuery('.stickyioproductcampaigndata').length > 0) { stickyioproductcampaigndata = jQuery('.stickyioproductcampaigndata').data('stickyioproductcampaigndata'); }
    if (jQuery('.stickyiocampaigns').length > 0) { stickyiocampaigns = jQuery('.stickyiocampaigns').data('stickyiocampaigns'); }
});

function updateCampaigns() {
    jQuery('input, button, select').attr('disabled', true);
    jQuery('.stickyiogetcampaignloading').show();
    jQuery.ajax({
        type: 'GET',
        url: jQuery('.stickyiogetcampaigns').attr('href'),
        success: function () { window.location = window.location; }
    });
}
