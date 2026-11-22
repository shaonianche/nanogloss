# Changelog

Notable changes to NanoGloss. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-22

First release.

### Added

- Selection bubble that translates the selected text on the device with Chrome's built-in
  Translator API, streams the result, and keeps code blocks verbatim.
- Trigger modes: translate on every selection, or on demand by holding Alt, by a long press, or
  both.
- Language packs: download on demand with progress in the bubble, and a list of ready packs on the
  settings page.
- Settings page with source and target language, trigger options, theme, a translation playground,
  and a browser support check.
- Toolbar button that opens the settings page.
- Welcome page that opens once after installing: a practice page with a guided tour that checks
  the browser, sets the languages and downloads the language pack, and has the user try each
  trigger, showing how long Chrome's built-in model took for each translation.
- UI in English, Japanese, Simplified Chinese, and Traditional Chinese.
