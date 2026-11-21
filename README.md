# NanoGloss

[English](README.md) · [简体中文](README.zh-CN.md)

Select text on any page to translate on-device with **Chrome's built-in Translator API** —
offline once a pack is downloaded, with no server, no account, and no API key.

![The NanoGloss bubble translating a selected paragraph in place](docs/store-assets/en/01-bubble.png)

## Features

- **Selection bubble**: translates prose while keeping block-level code (`<pre>`) verbatim
- **Flexible trigger modes**: translate immediately on selection, or on demand via shortcuts (holding Alt, long-pressing the mouse button, or both)
- **On-device language packs**: download on demand with live progress in the bubble and a ready list in Settings
- **Localized UI**: follows Chrome's interface language (English, Simplified Chinese, Traditional Chinese, and Japanese) and formats language names for the active locale
- **Theme support**: follows the system appearance or a light/dark preference
- **Translation playground**: test your configured language pair right inside the Settings page

Desktop Chrome 138+ is required: the Translator API is not available on mobile or in
Edge, Firefox, or Safari.

## Install

NanoGloss is not on the Chrome Web Store yet. Until it is, load it from source. You need
Node.js 26 and pnpm 12 (the versions in `package.json`).

1. Clone the repository and build the extension:

   ```bash
   git clone https://github.com/shaonianche/nanogloss.git
   cd nanogloss
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions` and turn on developer mode.
3. Choose "Load unpacked" and pick `.output/chrome-mv3`.

The settings page opens after installing. The toolbar button opens it again.

## Use

Select text while holding Alt (Option on macOS), or keep the mouse button held at the end of a
selection. The translation appears in a bubble next to the text; Escape or a click elsewhere closes
it. The settings page can switch to translating every selection, and sets the languages.

The first translation between two languages downloads a language pack of about 76 MB through
Chrome. The bubble asks for a click to start it.

## Known limitations

- Chrome does not run extensions on its own pages (`chrome://…`, the Chrome Web Store), so
  nothing can be translated there.
- Chrome exposes the Translator API to the top-level page and same-origin frames. In a
  cross-origin iframe NanoGloss does nothing, unless the embedding page allows it with
  `allow="translator"`.
- Selections inside text fields and editable areas are ignored.
- Only block-level code is kept verbatim: text inside `<pre>`, and a block that holds nothing
  but code. Inline code inside a sentence is translated with the sentence, because cutting it out
  would leave the translator a sentence with a hole in it. A string or a word inside inline code
  can therefore come back changed.
- The settings page lists the language packs that page can use. Chrome reports pack status
  separately for each site, so a pack downloaded while translating on a web page may be missing
  from the list until the settings page uses that language too. The pack is on disk either way.
- The first download of a language pack sometimes fails. "Try again" in the bubble, or on the
  settings page, usually succeeds.
- `chrome://on-device-translation-internals/`, linked from the System Status tab, is empty in
  some Chrome versions (seen in Chrome 157).
- Chrome translates through English, so a pair without English needs both languages' packs.
- The language list is Chrome's, and Chrome decides whether a pair is available on a device.

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
pnpm dev          # watch build into .output/chrome-mv3-dev
pnpm lint         # oxlint
pnpm test         # Vitest (jsdom); pnpm test:coverage adds a coverage table
pnpm type-check
pnpm build        # .output/chrome-mv3 — load it in chrome://extensions (developer mode)
pnpm zip          # .output/nanogloss-<version>-chrome.zip
```

`pnpm dev` writes to `.output/chrome-mv3-dev`; `pnpm build` writes to `.output/chrome-mv3`.

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
  LICENSE.txt         MIT license, included in the extension package
  THIRD_PARTY_NOTICES.txt  third-party licenses, included in the extension package
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report
vulnerabilities as described in [SECURITY.md](SECURITY.md). Changes are listed in
[CHANGELOG.md](CHANGELOG.md).

## License

The source code is open source under the [MIT License](LICENSE). Third-party notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); the full dependency list and license texts are in
`public/THIRD_PARTY_NOTICES.txt`, which is packaged as `THIRD_PARTY_NOTICES.txt`.

The NanoGloss name, logo, extension icons, Chrome Web Store screenshots and promotional
images, and store listing copy are brand assets and are not covered by the MIT License. See
[BRAND.md](BRAND.md).
