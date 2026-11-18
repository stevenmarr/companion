# Performance Video Control Center (built in)

The Control Center connection module (`pvllc-control-center`, legacy id `rs6-presets`), shipped with PV Companion so a
fresh install has the current module without importing a package. Built output only: the source is
[stevenmarr/companion-module-rs6-presets](https://github.com/stevenmarr/companion-module-rs6-presets).

Update it from a module checkout:

```sh
npm ci && npm test && npm run package    # writes pkg/ and pvllc-control-center-<version>.tgz
rm -rf <companion>/modules/pvllc-control-center/{main.js,package.json,LICENSE,companion}
cp -r pkg/. <companion>/modules/pvllc-control-center/
```

Because this module lists `rs6-presets` in `legacyIds`, Companion ignores any other built-in module with that id
(an old copy left in `modules/`) and moves `rs6-presets` connections to `pvllc-control-center` at start-up.
