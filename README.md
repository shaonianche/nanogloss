# NanoGloss

[English](README.md) · [简体中文](README.zh-CN.md)

Select text on any page to translate on-device with **Chrome's built-in Translator API** —
offline once a pack is downloaded, with no server, no account, and no API key.

## Features

- **Selection bubble**: translates prose while keeping code blocks verbatim
- **Flexible trigger modes**: translate immediately on selection, or on demand via shortcuts (holding Alt, long-pressing the mouse button, or both)
- **On-device language packs**: download on demand with live progress in the bubble and a ready list in Settings
- **Localized UI**: follows Chrome's interface language (English, Simplified Chinese, Traditional Chinese, and Japanese) and formats language names for the active locale
- **Theme support**: follows the system appearance or a light/dark preference
- **Translation playground**: test your configured language pair right inside the Settings page

Desktop Chrome 138+ is required: the Translator API is not available on mobile or in
Edge, Firefox, or Safari.

## Stack

| | |
|---|---|
| Extension framework | WXT 0.21 (MV3, Vite 8) |
| UI | React 19 + **HeroUI v3** on Tailwind CSS 4 |
| Language | TypeScript 7 |
| Injected UI | Shadow DOM (`createShadowRootUi`), styles isolated from the host page |

### HeroUI CSS strategy

HeroUI's stylesheet is split so each entrypoint ships only what it renders:

- `src/assets/styles/heroui.css` — foundation (theme tokens, base, custom utilities, variants),
  imported by every entrypoint that uses HeroUI.
- Each entrypoint's `style.css` then imports only the components it uses, e.g.
  `@import "@heroui/styles/components/card.css";`.

`@import "@heroui/styles"` would pull in all 85 components: in the content script that means
~446 kB of CSS injected into every page instead of ~60 kB.

Two details worth remembering:

- `tw-animate-css` must be imported explicitly — HeroUI's popover/animation utilities come from it.
- HeroUI's theme declares its variables on `:root, :host`, so it works inside the shadow root.
  Components built on React Aria **portals** (Select, Popover, Tooltip, …) mount outside the shadow
  root, so the bubble only uses in-place components; the options page can use all of them.

## Development

```bash
pnpm install
pnpm dev          # watch build into .output/chrome-mv3
pnpm lint         # oxlint
pnpm test         # Vitest (jsdom); pnpm test:coverage adds a coverage table
pnpm type-check
pnpm build        # .output/chrome-mv3 — load it in chrome://extensions (developer mode)
pnpm zip          # .output/nanogloss-<version>-chrome.zip
```

Releases: push a `v<version>` tag that matches `package.json`, and the Release workflow attaches the
`pnpm zip` archive to a GitHub release. Uploading it to the Chrome Web Store is a manual step.

Helper scripts:

- `pnpm test:profile` (`scripts/test-profile.mjs`) — starts Chrome with a dedicated profile and CDP on 9222,
  loads `.output/chrome-mv3`, and serves a test page on `127.0.0.1:8791`. Rerun after a build:
  restarting Chrome is what reloads the extension.
- `pnpm icons` (`scripts/generate-icons.mjs`) — rasterizes `public/icon/128.svg` into the PNG icon sizes.

## Layout

```
public/
  _locales/           Chrome extension i18n catalogs (en, ja, zh_CN, zh_TW)
  icon/               extension icons (SVG source + generated PNGs)
src/
  assets/styles/
    heroui.css        HeroUI foundation (tokens/base/utilities/variants) for all entrypoints
  entrypoints/
    background.ts     opens the settings page after install and from the toolbar button
    content/          content script: selection handling + bubble in a shadow root
      index.tsx         listeners, trigger modes, bubble placement
      selection.ts      reads the selection, splitting prose from code blocks
      selection.test.ts Vitest (jsdom) coverage for the splitting rules
      index.test.ts     Vitest (jsdom) coverage for the trigger gestures and bubble placement
      selection-bubble.tsx   HeroUI Card/ScrollShadow/Typography, in-place components only
      style.css         injected into the shadow root (cssInjectionMode: "ui")
    options/          settings page (language packs, triggers, system status, playground)
  utils/
    i18n.ts           typed wrapper around chrome.i18n.getMessage with English fallback
    languages.ts      language codes Chrome's translator supports (+ aliases & localized labels)
    translator.ts     typed wrapper around the built-in Translator API
    translation-controller.ts   the selection → translation state machine (bubble + playground)
    segments.ts       the prose/code segment model shared by selection and controller
    storage.ts        settings persisted in chrome.storage.local
    theme.ts          resolves the theme setting against the system preference
    browser-support.ts  what this browser can do (Translator API, detector, version)
    styles/           PostCSS plugin that renames Tailwind's `--tw-*` custom properties
```

### Why the custom PostCSS plugin

The bubble lives in a shadow root on arbitrary pages. Shadow DOM isolates *rules*, but
CSS custom properties and `rem` units still cross the boundary, so the build renames
`--tw-*` to `--ng-tw-*` and converts `rem` to `px`. Without that, a host page's Tailwind
build can change how our own UI looks.

## Privacy

NanoGloss collects nothing and makes no network requests of its own: see [PRIVACY.md](PRIVACY.md).
The fields for the Chrome Web Store dashboard are in [docs/chrome-web-store.md](docs/chrome-web-store.md).

## License

The source code is open source under the [MIT License](LICENSE).

The NanoGloss name, logo, extension icons, Chrome Web Store screenshots and promotional
images, and store listing copy are brand assets and are not covered by the MIT License. See
[BRAND.md](BRAND.md).
