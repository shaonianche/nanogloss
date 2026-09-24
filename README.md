# NanoGloss

Select text on any page and translate it with **Chrome's built-in Translator API** —
on-device, no server, no account, no API key.

## Features

- Selection bubble: prose is translated, code blocks are detected and kept verbatim
- Three trigger modes: right after selecting, only while holding Alt, or long-press
- Language packs download on demand, with progress in the bubble and a ready-list in the options page
- The options page translates its own UI with the same engine (English fallback when a pack is missing)
- Light/dark theme, following the system or an explicit choice
- Playground on the options page to try the configured language pair

Chrome 138+ on desktop is required: the Translator API does not exist on mobile, in
Edge, Firefox, or Safari.

## Stack

| | |
|---|---|
| Extension framework | WXT 0.20 (MV3, Vite 8) |
| UI | React 19 + **HeroUI v3** on Tailwind CSS 4 |
| Language | TypeScript 6 |
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
pnpm test         # Vitest (jsdom)
pnpm type-check
pnpm build        # .output/chrome-mv3 — load it in chrome://extensions (developer mode)
pnpm zip          # .output/nanogloss-<version>-chrome.zip
```

Helper scripts:

- `node scripts/test-profile.mjs` — starts Chrome with a dedicated profile and CDP on 9222,
  loads `.output/chrome-mv3`, and serves a test page on `127.0.0.1:8791`. Rerun after a build:
  restarting Chrome is what reloads the extension.
- `node scripts/generate-icons.mjs` — rasterises `public/icon/128.svg` into the PNG icon sizes.

## Layout

```
src/
  assets/styles/
    heroui.css        HeroUI foundation (tokens/base/utilities/variants) for all entrypoints
  entrypoints/
    content/          content script: selection handling + bubble in a shadow root
      index.tsx         listeners, trigger modes, bubble placement
      selection.ts      reads the selection, splitting prose from code blocks
      selection.test.ts Vitest (jsdom) coverage for the splitting rules
      selection-bubble.tsx   HeroUI Card/ScrollShadow/Typography, in-place components only
      style.css         injected into the shadow root (cssInjectionMode: "ui")
    options/          settings page (packs, triggers, theme, system status, playground)
  utils/
    languages.ts      the language codes Chrome's translator supports (+ aliases)
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

## License

MIT (see `LICENSE`).
