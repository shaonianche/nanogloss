# Architecture and Engineering Notes

[English](architecture.md) · [简体中文](architecture.zh-CN.md)

Internal structure, styling isolation, and build conventions for NanoGloss. For user-facing setup and usage, see [README.md](../README.md); for Chrome's built-in translation model and latency measurements, see [on-device-translation.md](on-device-translation.md).

## Stack

| Layer | Choice |
| --- | --- |
| Extension framework | WXT 0.21 (Manifest V3, Vite 8) |
| UI | React 19 + **HeroUI v3** on Tailwind CSS 4 |
| Language | TypeScript 7 |
| Injected UI | Shadow DOM (`createShadowRootUi`), styles isolated from the host page |

## HeroUI CSS strategy

HeroUI's stylesheet is split so each entrypoint ships only what it renders:

- `src/assets/styles/heroui.css` — shared foundation (theme tokens, base rules, custom utilities, variants), imported by every entrypoint that renders HeroUI.
- Each entrypoint's `style.css` imports only the components it uses inside `layer(components)`, e.g. `@import "@heroui/styles/components/card.css" layer(components);`.

Importing `@import "@heroui/styles"` directly would pull in all 85 components (~446 kB of CSS in the content script instead of ~83 kB). Keeping `layer(components)` on every HeroUI component import ensures Tailwind utility overrides in `layer(utilities)` continue to win over component defaults.

Key constraints for the Shadow DOM bubble:

- `tw-animate-css` is imported explicitly in `heroui.css` because HeroUI's transition and animation utilities depend on it.
- HeroUI switches themes through `data-theme` (`:root, :host` and `[data-theme="dark"]`), not `prefers-color-scheme` media queries alone. Both the options page and the bubble container set `data-theme` from the resolved `theme` setting.
- Components built on React Aria **portals** (`Select`, `Popover`, `Tooltip`) mount outside the shadow root and lose their styles, so the in-page bubble uses only in-place components (`Card`, `ScrollShadow`, `Button`, `Alert`, `ProgressBar`, `Spinner`, `Typography`).
- React Aria ignores shadow DOM events unless `enableShadowDOM()` from `react-stately/private/flags/flags` is called. `package.json` pins `react-stately` to the exact version `react-aria` depends on so the module-state flag applies to the same copy.

## Why the custom PostCSS plugin

The bubble lives inside a shadow root on arbitrary web pages. Shadow DOM isolates *selector rules*, but CSS custom properties (`--tw-*`) inherit across the shadow boundary and `rem` units resolve against the host page's `<html>` font size.

`src/utils/styles/postcss-rename-custom-props.cjs` renames `--tw-*` to `--ng-tw-*`, while `postcss-rem-to-responsive-pixel` converts `rem` to `px`. Together they prevent a host page's own Tailwind build or root font scaling from distorting the bubble.

## Repository layout

```text
docs/
  architecture.md                 Stack, Shadow DOM styling, and project layout (EN)
  architecture.zh-CN.md           Stack, Shadow DOM styling, and project layout (ZH)
  on-device-translation.md        Chrome's on-device model & measured translation speed (EN)
  on-device-translation.zh-CN.md  Chrome's on-device model & measured translation speed (ZH)
  chrome-web-store.md             Chrome Web Store dashboard copy (brand asset)
  store-assets/                   Chrome Web Store screenshots & promotional tiles (brand assets)
public/
  _locales/                       Chrome extension i18n catalogs (en, ja, zh_CN, zh_TW)
  icon/                           Extension icons (SVG source + generated PNGs, brand assets)
  LICENSE.txt                     MIT license, packaged into the extension archive
  THIRD_PARTY_NOTICES.txt         Third-party dependency notices, packaged into the archive
scripts/
  generate-icons.mjs              Rasterizes public/icon/128.svg into PNG icon sizes via CDP
  test-profile.mjs                Launches Chrome with a dedicated profile, CDP on 9222, and a test server
src/
  assets/styles/
    heroui.css                    Shared HeroUI foundation (tokens, base, utilities, variants)
    motion.css                    Shared motion keyframes and reduced-motion rules
  entrypoints/
    background.ts                 Opens the welcome page on install and settings from the toolbar button
    content/                      Content script: selection gestures + Shadow DOM bubble
      index.tsx                   Entrypoint wiring for web pages
      selection-translator.tsx    Shared selection listener and bubble lifecycle (also used by welcome)
      selection.ts                Reads the selection and splits prose from block-level code
      selection-bubble.tsx        In-place HeroUI bubble UI
      style.css                   Bubble stylesheet injected into the shadow root
    options/                      Settings page (languages, packs, triggers, system status, playground)
    welcome/                      First-install welcome page with interactive guided tour & stopwatch
  utils/
    browser-support.ts            Detects Translator API, Language Detector API, and Chromium version
    i18n.ts                       Typed wrapper around chrome.i18n.getMessage with English fallback
    languages.ts                  Supported BCP-47 language codes, aliases, and localized labels
    page-theme.ts                 Applies data-theme to extension pages and watches setting changes
    segments.ts                   Shared prose/code segment model
    storage.ts                    Typed settings persisted in chrome.storage.local
    styles/                       PostCSS plugin renaming --tw-* custom properties
    theme.ts                      Resolves system/light/dark theme preference
    translation-controller.ts     Selection → streaming translation state machine + tab memory cache
    translator.ts                 Typed wrapper around Chrome's Translator & Language Detector APIs
    typography.ts                 CJK/Latin script spacing and punctuation helpers
    use-settings.ts               React hook syncing NanoglossSettings across extension pages
```

## Build, test, and release scripts

```bash
pnpm install        # Runs wxt prepare to generate .wxt/ types
pnpm dev            # Watch build into .output/chrome-mv3-dev
pnpm lint           # oxlint (--deny-warnings)
pnpm type-check     # tsc --noEmit
pnpm test           # Vitest (jsdom); pnpm test:coverage adds a coverage table
pnpm build          # Production unpacked extension in .output/chrome-mv3
pnpm zip            # Chrome Web Store archive in .output/nanogloss-<version>-chrome.zip
pnpm test:profile   # Dedicated Chrome profile + test page on 127.0.0.1:8791 (run pnpm build first)
pnpm icons          # Regenerate PNG icons from public/icon/128.svg
```

Pushing a `v<version>` tag matching `package.json` runs `.github/workflows/release.yml`, which lints, type-checks, tests, builds `.output/nanogloss-<version>-chrome.zip`, and attaches it to a GitHub Release. Uploading that ZIP to the Chrome Web Store is performed manually in the Developer Dashboard.
