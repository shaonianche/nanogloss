# Contributing

Bug reports, fixes, and translations are welcome. For anything larger than a fix, open an issue
first, so the approach is agreed before you write it.

## Setup

You need Node.js 26, pnpm 12, and desktop Chrome 138 or newer.

```bash
pnpm install
pnpm dev          # watch build into .output/chrome-mv3
```

Load `.output/chrome-mv3` in `chrome://extensions` (developer mode, "Load unpacked").

`pnpm test:profile` starts Chrome with a dedicated profile, loads the build, and opens a test page
with text in several languages. Run `pnpm build` first, and rerun the script after each rebuild.

## Before you open a pull request

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

CI runs the same four. Then try the change in Chrome: the Translator API only exists in a real
browser, so the unit tests stub it. Say in the pull request what you tried and what you saw.

## Conventions

- `AGENTS.md` holds the project's rules: the HeroUI design system, the code quality rules, and the
  traps that have already cost time. Read it before a larger change.
- UI comes from HeroUI v3 components and tokens. Do not hand-build a control HeroUI already has.
- Every user-visible string goes through `t()` and needs an entry in all four catalogs under
  `public/_locales/` (`en`, `ja`, `zh_CN`, `zh_TW`). A test fails when the catalogs differ.
- A value the settings page owns belongs in `NanoglossSettings` (`src/utils/storage.ts`), not in a
  constant.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `fix(bubble): …`,
  `feat(options): …`. One change per commit. No emoji.
- A bug fix comes with a test that fails without it, when the bug can be reached from a unit test.

## Translations

To add a UI language, copy `public/_locales/en/messages.json` to a new locale directory, translate
each `message`, and keep the keys and the `$PLACEHOLDER$` names as they are. Add the catalog to
`LOCALE_CATALOGS` in `src/utils/i18n.test.ts`, so the test checks it too.

## Security

Do not report a vulnerability in a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).

The MIT License covers the code. The NanoGloss name, logo, icons, store screenshots, and store
listing copy are brand assets with their own terms: see [BRAND.md](BRAND.md). A pull request that
changes them, including the images under `docs/store-assets/`, needs the maintainer's agreement
first.
