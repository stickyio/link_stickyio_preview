# Changelog
All notable changes to this project will be documented in this file.


## [21.1.3] - 2021-03-29
[https://github.com/stickyio/link_stickyio_preview/commit/423c31bb646357a61db616d2e535b9cead9c8bb3](https://github.com/stickyio/link_stickyio_preview/commit/423c31bb646357a61db616d2e535b9cead9c8bb3)
### Changed
- Cart-EditProductLineItem modified to handle multiple product options
- Cart-AddProduct modified to default to quantity of 1 if quantity is not included

## [21.1.2] - 2021-03-26
[https://github.com/stickyio/link_stickyio_preview/commit/287634e4dfc5d3b7f3a5b92616721b9aded12252](https://github.com/stickyio/link_stickyio_preview/commit/287634e4dfc5d3b7f3a5b92616721b9aded12252)
[https://github.com/stickyio/link_stickyio_preview/commit/a28049800c1aa5c1212df2618e94aa4b526136ce](https://github.com/stickyio/link_stickyio_preview/commit/a28049800c1aa5c1212df2618e94aa4b526136ce)
[https://github.com/stickyio/link_stickyio_preview/commit/d7fcb781c5655a84de1eb2c3bf76033631934dff](https://github.com/stickyio/link_stickyio_preview/commit/d7fcb781c5655a84de1eb2c3bf76033631934dff)
[https://github.com/stickyio/link_stickyio_preview/commit/e962ab7872bc2c58f9b826d03f3c100b163bd2fe](https://github.com/stickyio/link_stickyio_preview/commit/e962ab7872bc2c58f9b826d03f3c100b163bd2fe)
### Changed
- Documentation includes Subscribe & Save example
- Various sanity checks and whitespace cleanup for easier diff-ing

## [21.1.1] - 2021-03-22
[https://github.com/stickyio/link_stickyio_preview/commit/17433aaa634591024ab50297a9263a43686456d8](https://github.com/stickyio/link_stickyio_preview/commit/17433aaa634591024ab50297a9263a43686456d8)
### Removed
- Unused variable in helper

### Changed
- Front-end Javascript multi-modal targetting bug fixes for SFRA stupidity

## [21.1.0] - 2021-03-22
[https://github.com/stickyio/link_stickyio_preview/commit/68b2ca5de17c9c92979e44a426d033316978e398](https://github.com/stickyio/link_stickyio_preview/commit/68b2ca5de17c9c92979e44a426d033316978e398)
[https://github.com/stickyio/link_stickyio_preview/commit/8305073013a4c5150a143831caf9000c258040a2](https://github.com/stickyio/link_stickyio_preview/commit/8305073013a4c5150a143831caf9000c258040a2)
[https://github.com/stickyio/link_stickyio_preview/commit/5310696c35e0a2e4abed6d69be3494d3087eab36](https://github.com/stickyio/link_stickyio_preview/commit/5310696c35e0a2e4abed6d69be3494d3087eab36)
[https://github.com/stickyio/link_stickyio_preview/commit/9ac988fe786872bc486d7cda596dc04b5b333019](https://github.com/stickyio/link_stickyio_preview/commit/9ac988fe786872bc486d7cda596dc04b5b333019)
### Removed
- SSO cache-busting header
- Straight Sale custom preference
- Out of the box Billing Models
- "Custom" Billing Model/Offer configuration and underlying processes/code
- Unused stickyioCycles decoratot

### Changed
- SSO route endpoint
- sticky.io subscription products are now driven by Shared Product Options
- Up to three Offers can be configured for a Product
- Template and Javascript efficencies
- Rewritten documentation
- Job steps aligned with new system and custom object manipulation processes
- Literal "null" sanity check on calculate.js
- Simplified Cart-EditProductLineItem route and additional sanity checks
- Quickview targetting

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
[https://github.com/stickyio/link_stickyio_preview/commit/4e597fc29ef53dc225fffdaf111be0174bafbee8](https://github.com/stickyio/link_stickyio_preview/commit/4e597fc29ef53dc225fffdaf111be0174bafbee8)
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
[https://github.com/stickyio/link_stickyio_preview/commit/619066aa5e7023cd81db6e778b8313f3b885e6cb](https://github.com/stickyio/link_stickyio_preview/commit/619066aa5e7023cd81db6e778b8313f3b885e6cb)
[https://github.com/stickyio/link_stickyio_preview/commit/a65c12c2b71960fcc8237f05835c1ad2323e9b15](https://github.com/stickyio/link_stickyio_preview/commit/a65c12c2b71960fcc8237f05835c1ad2323e9b15)
[https://github.com/stickyio/link_stickyio_preview/commit/5d2e54ccdb5e6adf8f91ce84e2ad1206b0a93cb2](https://github.com/stickyio/link_stickyio_preview/commit/5d2e54ccdb5e6adf8f91ce84e2ad1206b0a93cb2)
### Removed
- Site Custom Preference "Platform-Key" no longer in use - switched to a pure service API User/Password authentication model

### Changed
- Default to gateway id 1 when no gateway is set

## [20.1.2] - 2021-02-24
[https://github.com/stickyio/link_stickyio_preview/tree/cc23828f0d4a2c1e20a756c87f03bef1977df910](https://github.com/stickyio/link_stickyio_preview/tree/cc23828f0d4a2c1e20a756c87f03bef1977df910)
[https://github.com/stickyio/link_stickyio_preview/tree/d4248006cd29153c448c542ba846b50c40bf056b](https://github.com/stickyio/link_stickyio_preview/tree/d4248006cd29153c448c542ba846b50c40bf056b)
[https://github.com/stickyio/link_stickyio_preview/tree/74bb06c4f9f7d11c3276800ca3ca15dc4ee8f5f8](https://github.com/stickyio/link_stickyio_preview/tree/74bb06c4f9f7d11c3276800ca3ca15dc4ee8f5f8)
### Added
- New Data OCAPI permissions to allow access to System Objects in preparation for infintely customizable offer types and billing models

### Changed
- Sanity checks for various internal and external functions to keep error logs clean

## [20.1.1] - 2021-02-11
[https://github.com/stickyio/link_stickyio_preview/tree/804a169218bb0b54914219fcc76aabe60f1dbe60](https://github.com/stickyio/link_stickyio_preview/tree/804a169218bb0b54914219fcc76aabe60f1dbe60)
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
[https://github.com/stickyio/link_stickyio_preview/tree/b565ae966b2d0989cafe050ba7bc65f17d8186a5](https://github.com/stickyio/link_stickyio_preview/tree/b565ae966b2d0989cafe050ba7bc65f17d8186a5)
### Added
- Salesforce Commerce Cloud certified release
