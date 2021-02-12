🚨 This is a pre-release preview cartridge! While we've made every effort to make sure things work and are bug free, development continues! The latest, official release is available here: [https://github.com/SalesforceCommerceCloud/link_stickyio](https://github.com/SalesforceCommerceCloud/link_stickyio) 🚨

# sticky.io

[sticky.io](https://sticky.io) SFCC Cartridge

The Salesforce Commerce Cloud [sticky.io](https://sticky.io) Cartridge is a deeply integrated Salesforce Reference App best-practice-following implementation of [sticky.io](https://sticky.io)'s subscription services.

# SFRA version

This cartridge is built against [SFCC SFRA](https://github.com/SalesforceCommerceCloud/storefront-reference-architecture) version 4.4.1 and is guaranteed compatible with B2C Commerce API v18.10+

# Quick Start Installation

1. Clone this repository.

2. Modify `package.json`'s `paths: { base: {} }` value to point to your local copy of the `storefront-reference-architecture`'s `app_storefront_base` cartridge.

3. Run `npm install` to install all of the local dependencies (**node version 11.15 recommended**).

4. Run `npm run compile:js` from the command line to compile all client-side JS files. Run `npm run compile:scss` to do the same for CSS.

5. Upload the `cartridges` folder to the appropriate instance with the WebDAV client of your choice or by running `npm run uploadCartridge` to upload both the storefront and the Business Manager cartridge to the instance (this assumes a well-configured `dw.json` file is present).

6. Add the `int_stickyio_sfra` cartridge to your cartridge path in Business Manager at: _Administration >  Sites >  Manage Sites > {YOURSITE} - Settings_.

7. Add the `bm_stickyio` cartridge to your cartridge path in Business Manager at: _Administration >  Sites >  Manage Sites > Business Manager - Settings_.

8. Grant write permissions to the appropriate Business Manager user(s) for the new sticky.io Business Manager Extension by visiting: _Administration > Organization > Roles_, selecting the appropriate Role, switching to the "Business Manager Modules" tab, selecting the appropriate Site context(s), and scrolling down until you see the new sticky.io modules. This will append a new sticky.io submenu under the Business Manager's site's _Merchant Tools_ as well as add a new menu item under the existing _Ordering_ menu.

9. Open the `./metadata/site_import/sites` folder and change the name of `yourSiteID` to your Storefront's Site ID.

10. Zip the `./metadata/site_import` folder and place the resulting zip file somewhere you can find it for use in the next step.

11. Navigate to _Administration -> Site Development -> Site Import & Export_ to import the zip file you created in the previous step, which will install the custom STICKYIO Site Preferences, jobs, services, payment method and processor, and system and custom-objects.

12. Navigate to the new STICKYIO custom site preferences in Business Manager (_Merchant Tools -> Site Preferences -> Custom Preferences -> STICKYIO_) and configure your preferences. If you haven't yet become a [sticky.io](https://sticky.io), now would be a good time... you're gonna need the `Platform-Key` and `Instance Domain` to proceed!

13. Run the `sticky.io Shipping Methods Update` job.

14. Set up some subscription products in Business Manager, run the `sticky.io Product Sync` job, and you're on your way!

# Testing

`npm run test:unit` for unit tests

`npm run test:integration` for integration tests - assumes a well-configured `dw.json` file is present

# Further Reading

Extensive documentation is provided in the _/documentation_ folder of this repository.
