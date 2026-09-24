# AGENTS.md

## Notes

- `pnpm build` produces the loadable extension in `.output/chrome-mv3`
  (load it via `chrome://extensions` → developer mode → "Load unpacked").
- `pnpm zip` produces the Chrome Web Store archive in `.output/`.
- `pnpm type-check` runs `tsc --noEmit`.
- `pnpm test` runs Vitest (jsdom) over `src/**/*.test.ts`.
- Chrome 138+ on desktop is required — the Translator API is Chrome-only.

## Design

HeroUI v3 is the component and design system: https://heroui.com/ (`@heroui/react` for the
components, `@heroui/styles` for their CSS and tokens). Do not build your own UI primitives — use
its components, their variants and their tokens.

- Reach for an existing component first: `Button`, `Card`, `Chip`, `Alert`, `Select`, `Input`,
  `NumberField`, `ProgressBar`, `Spinner`, `ScrollShadow`, `Separator`, `Switch`, `Typography`,
  `Label`, `Description`, `ListBox`. Local components exist to compose those into feature UI
  (`SelectionBubble`, `PackRow`, `CheckRow`), never to re-implement one.
- Style with HeroUI tokens (`bg-default`, `text-muted`, `border-border`, `bg-separator`, …), not
  hardcoded palette colors (`neutral-100`, `neutral-800`, …) — the tokens carry the theme.
- Import per component, never the bundle: `src/assets/styles/heroui.css` is the shared foundation,
  and each entrypoint adds only the component CSS it renders, e.g.
  `@import "@heroui/styles/components/card.css";`. `@import "@heroui/styles"` would pull in all 85
  components: ~446 kB of CSS in the content script instead of ~60 kB.
- The in-page bubble lives in a shadow root, so it may only use components that render in place.
  Anything built on React Aria portals (`Select`, `Popover`, `Tooltip`) mounts outside the shadow
  root and loses the styles; those belong to the options page.
- Component CSS lives in `node_modules/@heroui/styles/dist/components/` (85 files); component APIs
  in `node_modules/@heroui/react`.

## Development Rules

### Conversational Style

- Keep answers short and concise
- No emojis in commits, issues, PR comments, or code
- No fluff or cheerful filler text (e.g. "Thanks @user", not "Thanks so much @user!")
- Technical prose only, be direct
- Use concise, clear, simple language. Define unavoidable jargon before using it.
- Explain non-trivial designs and problems as: problem, concrete example or short trace, then
  solution. State why the solution is necessary and distinguish it from optional complexity.
- Prefer concrete behavior and small illustrations over abstract summaries, dense terminology,
  or unexplained lists of changes.
- When the user asks a question, answer it first before making edits or running implementation
  commands.
- When responding to user feedback or an analysis, explicitly say whether you agree or disagree
  before saying what you changed.

### Code Quality

- Read files in full before wide-ranging changes, before editing files you have not fully
  inspected, and when asked to investigate or audit. Do not rely on search snippets for broad
  changes.
- No `any` unless absolutely necessary.
- Inline single-line helpers that have only one call site.
- Check `node_modules` for external API types (`wxt`, `@heroui/react`); don't guess.
- No inline imports (`await import()`, `import("pkg").Type`, dynamic type imports). Top-level
  imports only.
- Never remove or downgrade code to fix type errors from outdated deps; upgrade the dep instead.
- Keep type syntax erasable: no `enum`, `namespace`/`module`, parameter properties, `import =`
  or `export =`. Use plain types, objects and explicit fields instead.
- Always ask before removing functionality or code that appears intentional.
- Do not preserve backward compatibility unless the user asks for it.
- Never hardcode values the options page owns: put them in `NanoglossSettings`
  (`src/utils/storage.ts`) with a default in `DEFAULT_SETTINGS`, so they stay configurable.
- Never edit generated output by hand: `.output/` (`pnpm build`, `pnpm zip`) and `.wxt/`
  (`wxt prepare`) are gitignored build products. Change `src/` or `wxt.config.ts`, then rebuild.

## Traps

- WXT resets the shadow host with `:host { all: initial !important }`, and an important rule beats
  a non-important inline style. Styling `ui.shadowHost` from the content script therefore does
  nothing: the host stays `position: static; display: inline` and the UI drops into the page's flow
  at the bottom of the document. Position `ui.uiContainer` instead — WXT's own `overlay` position
  styles an element inside the shadow root for the same reason.
- Scroll events inside the shadow root never reach `window`, so the bubble's own scrolling cannot
  dismiss it. Only a page scroll hides the bubble; that listener needs no extra guard.
- `scripts/test-profile.mjs` is how to watch the extension run: it serves a test page on
  `127.0.0.1:8791`, starts Chrome with a dedicated profile (`%TEMP%\nanogloss-test-profile`) and a
  CDP endpoint on `9222`, and loads `.output/chrome-mv3` through `Extensions.loadUnpacked` (Chrome
  137+ dropped `--load-extension`). Run `pnpm build` first, and rerun the script after a rebuild:
  restarting Chrome is what reloads the extension.
- That profile keeps its settings and language packs between runs, so a stored value can differ
  from `DEFAULT_SETTINGS` — a `trigger: "alt"` in there means a selection made without Alt is
  ignored by design, not broken.
- HeroUI switches themes through `data-theme`, not `prefers-color-scheme` — its dark variables live
  under `[data-theme="dark"]`. The options page sets it in `main.tsx`; the bubble inherits whatever
  the host page declares, so it renders in HeroUI's light theme on pages that set nothing. Prefer
  tokens over `dark:` classes so a surface has only one theme mechanism.
- To drive the bubble from CDP, set a `Range` on the page and dispatch `mouseup` on `document`
  (with `altKey: true` when the profile stores `trigger: "alt"`); use `Input.dispatchMouseEvent`
  when the test needs a real user gesture. Scroll the target into view and let the scroll settle
  first: a page scroll dismisses the bubble, so a stray layout shift looks like a failure.
