The inclusion of the config folder and countries.json and httpHeadersConf.json are necessary since (modern and correctly coded) Business Manager extensions are called via the server Module. server Module *requires* the json config files typically found within the app_storefront_base cartridge, however, there is no way to reference these files without significant an unnecessary work extending Modules' base code.

The other solution to not including these files is to add app_storefront_base to the Business Manager site's cartridge settings, but this seems like a bad idea.

An issue has been opened with SFCC to address.