# ADR 0002: Dependency Install Warning Remediation

## Status

Proposed

## Date

2026-06-27

## Context

After merging `origin/master` into `milonga`, `yarn install` completed successfully but produced several warnings. The application now builds with `yarn build:main` and `yarn build:renderer`, so these warnings should not block Milonga planning. They should be tracked because they can hide future dependency breakage, especially for a DJ-oriented app that must be reliable before live use.

The install was first run with Node `v26.3.1`, while the README recommends Node `v20.17.0`. Node reports `DEP0169` because some tooling still uses the legacy `url.parse()` path; Node documents that `url.parse()` is non-standard and recommends the WHATWG URL API instead. Node 20 should be treated as a short-term stabilization target, not a permanent platform ceiling.

## Decision

Keep the merge moving and treat install warnings as separate maintenance PRs. Do not mix dependency cleanup with Milonga feature work unless a warning becomes a build or runtime failure. Pin Node 20 for immediate development, then plan a deliberate upgrade to the latest supported Node.js once dependency compatibility is verified.

## Observed Warnings

- `DEP0169` from Node while running Yarn/electron-builder tooling.
- `electron-builder > app-builder-lib` has unmet peer dependency `electron-builder-squirrel-windows`.
- `@hugotomazi/capacitor-navigation-bar@4.0.1` declares peer support for Capacitor 4-6, while this repo uses `@capacitor/core@7.2.0`.
- `unocss-preset-colors-rgb@1.0.0` declares unmet peer dependency `@unocss/core >=0.56.0`.
- `bare-fs` and `bare-os` declare a `bare` engine that Yarn Classic reports as invalid.
- `boolean@3.2.0` is deprecated through electron-builder transitive dependencies.

## Observed Runtime Failure

On macOS, development startup can fail with the system popup `Electron quit unexpectedly.` The crash reproduces with plain Electron, before Amethyst code starts:

- `./node_modules/.bin/electron --version` exits with `SIGABRT`.
- Crash reports show `EXC_CRASH`, `Abort trap: 6`, and `_RegisterApplication` / `NSApplication` in the crashing thread.
- `ELECTRON_RUN_AS_NODE=1 Electron ...` works, which means the binary can run as Node but fails when registering as a macOS app.
- `open Electron.app` reports `NSOSStatusErrorDomain Code=-10827` (`kLSNoExecutableErr`).

This points to a local Electron bundle or macOS LaunchServices/AppKit registration problem, not to Milonga code.

## Candidate PRs

### PR 1: Pin Supported Node Toolchain

Add `.nvmrc` with `20.17.0` and add `package.json` `engines.node` to match the README. This should reduce Node 26-only deprecation noise and make installs reproducible.

Acceptance:

- `node --version` matches documented support in local setup.
- `yarn install`, `yarn build:main`, and `yarn build:renderer` pass on Node 20.

### PR 1B: Upgrade to Latest Node.js

After the repo is stable on Node 20, test the latest active Node.js release and update the documented toolchain. This will likely require dependency cleanup first, because current install tooling can pull packages that require Node `>=22.12.0`.

Acceptance:

- `yarn install --force` passes on the selected latest Node.js version.
- `yarn build:main`, `yarn build:renderer`, and `yarn dev` pass.
- ADR 0002 and contributor setup docs are updated with the new Node.js version.

### PR 2: Remove Global electron-builder Preinstall

Replace `preinstall: yarn global add electron-builder` with local package usage. `electron-builder` is already a project dependency and scripts should use `node_modules/.bin` through Yarn.

Acceptance:

- Fresh `yarn install` no longer performs a global install.
- Packaging scripts still run through `yarn package`.

### PR 3: Resolve Capacitor Navigation Bar Compatibility

Validate whether `@hugotomazi/capacitor-navigation-bar@4.0.1` works with Capacitor 7. If it works, open or apply an upstream-style peer-range PR to include Capacitor 7. If it does not, replace the plugin or isolate its usage behind a platform capability check.

Acceptance:

- Android build and runtime navigation-bar behavior are verified.
- Install no longer reports the Capacitor peer mismatch.

### PR 4: Normalize UnoCSS Peer Dependencies

Add an explicit compatible `@unocss/core` dev dependency or replace `unocss-preset-colors-rgb` with maintained UnoCSS configuration.

Acceptance:

- `yarn install` no longer reports the UnoCSS peer warning.
- Renderer build output remains visually unchanged.

### PR 5: Clean Renderer Build CSS Warnings

The renderer build emits invalid CSS warnings from dynamic classes in `src/renderer/components/LazyList.vue` and `src/renderer/components/TrackSelector.vue`, such as ``h-[${ITEM_HEIGHT}px]``. Replace these with static classes plus style bindings or UnoCSS-safe values.

Acceptance:

- `yarn build:renderer` no longer emits `ITEM_HEIGHT` CSS syntax warnings.
- Lazy-list row sizing remains stable.

### PR 6: Add Electron Dev Startup Diagnostics

Add a documented smoke check for the Electron runtime before running the app:

```bash
./node_modules/.bin/electron --version
```

If this fails, reinstall Electron's downloaded binary and reset LaunchServices before debugging Amethyst code.

Acceptance:

- The README or contributor guide includes the smoke check and repair steps.
- `yarn dev` failure reports distinguish Electron runtime failure from application startup failure.

### PR 7: Evaluate Electron Version Pinning

If Electron 36.2.0 continues to crash on supported macOS machines after a clean reinstall and LaunchServices reset, test the newest Electron patch release and a previous stable Electron line. Pin the known-good version exactly instead of using a broad caret range.

Acceptance:

- `./node_modules/.bin/electron --version` works on the supported macOS development machine.
- `yarn dev` opens the app window.
- Native modules are rebuilt with `electron-builder install-app-deps`.

## Deferred Items

- `electron-builder-squirrel-windows` can be ignored while Windows packaging uses NSIS only. Add it only if Squirrel packaging becomes a target.
- `boolean@3.2.0` is transitive through packaging tooling; prefer upgrading electron-builder when upstream removes it rather than overriding it locally.
- `bare-fs` and `bare-os` engine warnings appear harmless under Yarn Classic and should be revisited only if installs fail.
- The macOS `Electron quit unexpectedly` failure should be handled as an environment/runtime repair first. Do not modify Milonga code for this symptom unless Electron itself starts successfully and the crash moves into Amethyst code.

## Consequences

Keeping this as maintenance work prevents dependency churn from delaying Milonga planning. The main risk is warning fatigue, so the candidate PRs should be handled before release packaging or event-readiness testing.

## References

- Node.js deprecation documentation for `DEP0169`: https://nodejs.org/api/deprecations.html#DEP0169
