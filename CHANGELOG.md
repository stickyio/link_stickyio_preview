# Changelog
All notable changes to this project will be documented in this file.

## [21.1.19] - 2021-05-26
### Added
- New service to void a sticky.io order
- Custom field demo code (commented out) for OCAPI order hooks on re-bill
- Voiding of sticky.io order when SFCC order creation fails

## [21.1.18] - 2021-05-25
[d129b6280bcc5fd6dd3e656f8755a0f285bb032e](https://github.com/stickyio/link_stickyio_preview/commit/d129b6280bcc5fd6dd3e656f8755a0f285bb032e)
### Added
- New service to update `custom_fields` on a sticky.io order
- New method to call updating `custom_fields` on existing sticky.io order

## [21.1.17] - 2021-05-21
[323a92247debd3cefb611e262be57b1248f51823](https://github.com/stickyio/link_stickyio_preview/commit/323a92247debd3cefb611e262be57b1248f51823)
### Added
- Sanity check for campaign products

### Changed
- Linting cleanups

## [21.1.16] - 2021-05-20
[57aa5ffd53ce004de64d82efd3395b361b76cee7](https://github.com/stickyio/link_stickyio_preview/commit/57aa5ffd53ce004de64d82efd3395b361b76cee7)
### Added
- Wipe custom object during product reset

### Changed
- Removed checkpoint object from syncing API calls to keep error logs clean

## [21.1.15] - 2021-05-18
[fbbe07ba4b2ae56c4a8c5f44163cb68ed0e5f3c0](https://github.com/stickyio/link_stickyio_preview/commit/fbbe07ba4b2ae56c4a8c5f44163cb68ed0e5f3c0)
### Changed
- Default CSR email address for sending error emails changed to working domain
- Better detection if using invalid CSR email for site
- Wrapped `new_order` response in larger try/catch to prevent failed orders when not necessary

## [21.1.14] - 2021-05-11
[4149851601be055b6454397805d6370c7cd514c3](https://github.com/stickyio/link_stickyio_preview/commit/4149851601be055b6454397805d6370c7cd514c3)  
[68ed5be1a7d7b193eb66e5c789cdef61c3d2fd9](https://github.com/stickyio/link_stickyio_preview/commit/668ed5be1a7d7b193eb66e5c789cdef61c3d2fd9)
### Added
- Ability to pass in custom headers for sticky.io API calls
- Custom headers for sso call

### Changed
- Variable scoping in helper and collect returned `subscriptionIDs` just in case for future development

## [21.1.13] - 2021-04-20
[3b46ae974c041ac7ce6f7a3943ee4ea74f49138c](https://github.com/stickyio/link_stickyio_preview/commit/3b46ae974c041ac7ce6f7a3943ee4ea74f49138c)
### Changed
- Sanity checks for Kount
- Default params for straight-sale subscription products in `new_order` call

## [21.1.12] - 2021-04-16
[71646e114d3ede6978bceba0e12574eca4ae63b8](https://github.com/stickyio/link_stickyio_preview/commit/71646e114d3ede6978bceba0e12574eca4ae63b8)
### Changed
- Use `token` instead of `id` when passing `custom_fields` in the sticky.io `new_order` API call

### Removed
- SFCC-generation/validation/storage of sticky.io required custom fields, associated jobs, code, and system preference custom attributes

## [21.1.11] - 2021-04-15
[0ddba49bae3354b34f09f5f9d66082b536d62e0d](https://github.com/stickyio/link_stickyio_preview/commit/0ddba49bae3354b34f09f5f9d66082b536d62e0d)
### Changed
- Check if sticky.io cartridge is enabled before running any custom OCAPI hooks or modified `cart/calculate.js` function

## [21.1.10] - 2021-04-13
[3d0e22de433174d2e107533ea1a07f660aadce51](https://github.com/stickyio/link_stickyio_preview/commit/3d0e22de433174d2e107533ea1a07f660aadce51)  
[df58acc87764b1079549058b825e4c5af635d789](https://github.com/stickyio/link_stickyio_preview/commit/df58acc87764b1079549058b825e4c5af635d789)
### Changed
- Always check `is_recurring` to determine if subscription is active and remove display of hold date in subscription management
- Changed default `label.subscriptionmanagement.on_hold` localization value

### Removed
- API routes to `pause` endpoint have been replaced with `stop` endpoint, but all language says "pause"

## [21.1.9] - 2021-04-11
[0162b211f3c9b3da731e37e7e6e919b3c6555b8c](https://github.com/stickyio/link_stickyio_preview/commit/0162b211f3c9b3da731e37e7e6e919b3c6555b8c)  
[cda0d425fb89141a90d8851d35d95011a8b64236](https://github.com/stickyio/link_stickyio_preview/commit/cda0d425fb89141a90d8851d35d95011a8b64236)  
[993841bd6448e076ef8a7798528fb97dcaa532f4](https://github.com/stickyio/link_stickyio_preview/commit/993841bd6448e076ef8a7798528fb97dcaa532f4)  
[b8906b33b102a49ab2c1891257ea8c9765742166](https://github.com/stickyio/link_stickyio_preview/commit/b8906b33b102a49ab2c1891257ea8c9765742166)
### Changed
- Sanity checks in API request/response
- If consumer-selectable terms is true, but only one term available, default to that one term
- sticky.io required custom fields are now their own job step
- Allow multiple subscription management result messages by targeting `subscriptionID`

## [21.1.8] - 2021-04-09
[39bb9bacacf963dd22e40b33574aaf490ea1df44](https://github.com/stickyio/link_stickyio_preview/commit/39bb9bacacf963dd22e40b33574aaf490ea1df44)
### Changed
- Fixed SFCC storage of sticky `subscription_id` in `new_order` return
- Added prepaid terms display in customer subscription management

## [21.1.7] - 2021-04-07
[90f666d03cc8b18d227553c8ccbfa65570e97349](https://github.com/stickyio/link_stickyio_preview/commit/90f666d03cc8b18d227553c8ccbfa65570e97349)  
[b962dce3365c296a86d61f1f21a53086516ffea1](https://github.com/stickyio/link_stickyio_preview/commit/b962dce3365c296a86d61f1f21a53086516ffea1)  
[b9a731bae46e126905f881c662dc2c4c9fe61f56](https://github.com/stickyio/link_stickyio_preview/commit/b9a731bae46e126905f881c662dc2c4c9fe61f56)  
[90ac8c44586563268f093621bc3a67d3a9edde82](https://github.com/stickyio/link_stickyio_preview/commit/90ac8c44586563268f093621bc3a67d3a9edde82)
### Changed
- Removed unused debug variables and fixed linting complaints
- Fixed major bug in `getActiveBillingModels()` where it was not looping through available offer objects

### Added
- Integrity checks for system custom attributes and shared product options
- New hostname custom preference and field created in sticky.io to store order's origin hostname - includes new system object custom preference metadata definition

## [21.1.6] - 2021-04-06
[e9ac0128f93cb7d33dec076686516b1072e4d16a](https://github.com/stickyio/link_stickyio_preview/commit/e9ac0128f93cb7d33dec076686516b1072e4d16a)  
[f4345e3dffff22c0cf2a71df48029fa7fa7bb905](https://github.com/stickyio/link_stickyio_preview/commit/f4345e3dffff22c0cf2a71df48029fa7fa7bb905)
### Removed
- Localization "examples" for offers, billing models, and prepaid terms

### Changed
- Sanity check for stickyio response return object
- Documentation to include localization examples for offers, billing models, and prepaid terms

## [21.1.5] - 2021-04-02
[8521db282901c3f090fbcdc9f06257da0ba8fa81](https://github.com/stickyio/link_stickyio_preview/commit/8521db282901c3f090fbcdc9f06257da0ba8fa81)  
[cae39d8c37ac83e531bda817901e80495d4713bc](https://github.com/stickyio/link_stickyio_preview/commit/cae39d8c37ac83e531bda817901e80495d4713bc)
### Changed
- Sanity check for product options in `Cart-EditProductLineItem` route
- Reduced complexity of models, decorators, and helpers by using `superModule`
- Accompanying unit test modifications to handle model superModule changes

## [21.1.4] - 2021-03-31
[01b15d194e0d5acd8b9bd7db3f51e388fbba0772](https://github.com/stickyio/link_stickyio_preview/commit/01b15d194e0d5acd8b9bd7db3f51e388fbba0772)
### Changed
- When dealing with $0 or 0% off prepaid terms, make the default label only show number of cycles and not discount amount

## [21.1.3] - 2021-03-29
[423c31bb646357a61db616d2e535b9cead9c8bb3](https://github.com/stickyio/link_stickyio_preview/commit/423c31bb646357a61db616d2e535b9cead9c8bb3)  
[9bcc0041c7789ac0df7904bd906377efa9210bc8](https://github.com/stickyio/link_stickyio_preview/commit/9bcc0041c7789ac0df7904bd906377efa9210bc8)
### Removed
- Unused variables in route

### Changed
- `Cart-EditProductLineItem` modified to handle multiple product options
- `Cart-AddProduct` modified to default to quantity of 1 if quantity is not included

## [21.1.2] - 2021-03-26
[287634e4dfc5d3b7f3a5b92616721b9aded12252](https://github.com/stickyio/link_stickyio_preview/commit/287634e4dfc5d3b7f3a5b92616721b9aded12252)  
[a28049800c1aa5c1212df2618e94aa4b526136ce](https://github.com/stickyio/link_stickyio_preview/commit/a28049800c1aa5c1212df2618e94aa4b526136ce)  
[d7fcb781c5655a84de1eb2c3bf76033631934dff](https://github.com/stickyio/link_stickyio_preview/commit/d7fcb781c5655a84de1eb2c3bf76033631934dff)  
[e962ab7872bc2c58f9b826d03f3c100b163bd2fe](https://github.com/stickyio/link_stickyio_preview/commit/e962ab7872bc2c58f9b826d03f3c100b163bd2fe)
### Changed
- Documentation includes Subscribe & Save example
- Various sanity checks and whitespace cleanup for easier diff-ing

## [21.1.1] - 2021-03-22
[17433aaa634591024ab50297a9263a43686456d8](https://github.com/stickyio/link_stickyio_preview/commit/17433aaa634591024ab50297a9263a43686456d8)
### Removed
- Unused variable in helper

### Changed
- Front-end Javascript multi-modal targeting bug fixes for SFRA stupidity

## [21.1.0] - 2021-03-22
[68b2ca5de17c9c92979e44a426d033316978e398](https://github.com/stickyio/link_stickyio_preview/commit/68b2ca5de17c9c92979e44a426d033316978e398)  
[8305073013a4c5150a143831caf9000c258040a2](https://github.com/stickyio/link_stickyio_preview/commit/8305073013a4c5150a143831caf9000c258040a2)  
[5310696c35e0a2e4abed6d69be3494d3087eab36](https://github.com/stickyio/link_stickyio_preview/commit/5310696c35e0a2e4abed6d69be3494d3087eab36)  
[9ac988fe786872bc486d7cda596dc04b5b333019](https://github.com/stickyio/link_stickyio_preview/commit/9ac988fe786872bc486d7cda596dc04b5b333019)
### Removed
- SSO cache-busting header
- Straight Sale custom preference
- Out of the box Billing Models
- "Custom" Billing Model/Offer configuration and underlying processes/code
- Unused `stickyioCycles` decorator

### Changed
- SSO route endpoint
- sticky.io subscription products are now driven by Shared Product Options
- Up to three Offers can be configured for a Product
- Template and Javascript efficencies
- Rewritten documentation
- Job steps aligned with new system and custom object manipulation processes
- Literal "null" sanity check on calculate.js
- Simplified `Cart-EditProductLineItem` route and additional sanity checks
- Quickview targeting

### Added
- Support for any Billing Model
- Localization of Offers, Billing Models, and Terms
- Full Campaign & Promotion engine compatibility (Subscribe & Save, Prepaid, etc.)
- Ability to allow consumer to select Prepaid Terms
- XML and OCAPI system manipulation of sticky.io-related objects
- Baseline template CSS
- SFRA support for Products with multiple _selectable_ Product Options (core SFRA bug fix)
- Working unit tests

## [20.1.4] - 2021-03-10
[4e597fc29ef53dc225fffdaf111be0174bafbee8](https://github.com/stickyio/link_stickyio_preview/commit/4e597fc29ef53dc225fffdaf111be0174bafbee8)
### Removed
- Unused functions for discounts and legacy Business Manager functions
- Unused Business Manager templates
- Unused Business Manager javascript
- Unused Business Manager localization strings

### Changed
- Consolidation of Business Manager extensions under sticky.io menu
- iframe rendering to use single template
- iframe CSS moved from inline to file
- SSO route to use cache-busting header
- Various typo-in-comments fixes
- service log file prefix normalization

### Added
- New Billing Model and Configuration sticky.io menu actions
- Business Manager localization strings for sticky.io breadcrumbs

## [20.1.3] - 2021-03-06
[619066aa5e7023cd81db6e778b8313f3b885e6cb](https://github.com/stickyio/link_stickyio_preview/commit/619066aa5e7023cd81db6e778b8313f3b885e6cb)  
[a65c12c2b71960fcc8237f05835c1ad2323e9b15](https://github.com/stickyio/link_stickyio_preview/commit/a65c12c2b71960fcc8237f05835c1ad2323e9b15)  
[5d2e54ccdb5e6adf8f91ce84e2ad1206b0a93cb2](https://github.com/stickyio/link_stickyio_preview/commit/5d2e54ccdb5e6adf8f91ce84e2ad1206b0a93cb2)  
### Removed
- Site Custom Preference "Platform-Key" no longer in use - switched to a pure service API User/Password authentication model

### Changed
- Default to Gateway ID 1 when no gateway is set

## [20.1.2] - 2021-02-24
[cc23828f0d4a2c1e20a756c87f03bef1977df910](https://github.com/stickyio/link_stickyio_preview/commit/cc23828f0d4a2c1e20a756c87f03bef1977df910)  
[d4248006cd29153c448c542ba846b50c40bf056b](https://github.com/stickyio/link_stickyio_preview/commit/d4248006cd29153c448c542ba846b50c40bf056b)  
[74bb06c4f9f7d11c3276800ca3ca15dc4ee8f5f8](https://github.com/stickyio/link_stickyio_preview/commit/74bb06c4f9f7d11c3276800ca3ca15dc4ee8f5f8)
### Added
- New Data OCAPI permissions to allow access to System Objects in preparation for infintely customizable offer types and billing models

### Changed
- Sanity checks for various internal and external functions to keep error logs clean

## [20.1.1] - 2021-02-11
[804a169218bb0b54914219fcc76aabe60f1dbe60](https://github.com/stickyio/link_stickyio_preview/commit/804a169218bb0b54914219fcc76aabe60f1dbe60)
### Added
- Analytics Business Manager Extension
- Merchant settable Gateway ID
- Site ID custom field creation and syncing with sticky.io
- Kount anti-fraud
- Groundwork for Campaigns & Promotion functionality

### Changed
- API User/Password BASIC authentication for API requests
- Javascript efficiencies for targetting elements on front-end helpers
- Javascript front-end sanity checks
- iframe height fix
- Product Set quickview fix
- OCAPI permissions for future Campaigns & Promotion functionality
- Core library bug fixes

## [20.1.0] - 2020-08-12
[b565ae966b2d0989cafe050ba7bc65f17d8186a5](https://github.com/stickyio/link_stickyio_preview/commit/b565ae966b2d0989cafe050ba7bc65f17d8186a5)
### Added
- Salesforce Commerce Cloud certified release
