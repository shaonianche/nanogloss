# Privacy Policy

Last updated: 2026-11-21

NanoGloss translates text you select on a web page, using the Translator API built into
Chrome. The translation runs on your device.

## What NanoGloss collects

Nothing. NanoGloss has no server, no account, no analytics, and no advertising. It makes no
network requests of its own.

## What NanoGloss reads

- **The text you select.** When you trigger a translation, NanoGloss reads the selected text
  and passes it to Chrome's built-in Translator API and Language Detector API. Both run on
  your device. The text and its translation are kept in the page's memory so that selecting
  the same text again is instant, and are discarded when you close or reload the page. They
  are never written to disk or sent anywhere.
- **The page's declared language** (the `lang` attribute), used as a fallback when the source
  language is set to auto-detect.

NanoGloss does not read page content you have not selected, and it ignores selections inside
form fields and editable areas.

## What NanoGloss stores

Your settings (source and target language, trigger mode, long-press delay, minimum selection
length, theme) are stored with `chrome.storage.local` on your device. They are not synced and
not shared. Removing the extension deletes them.

## Language packs

The first translation between two languages needs a language pack. Chrome downloads it from
Google, the same way it downloads its other components; NanoGloss only asks Chrome for a
translator. That download is covered by the
[Google Chrome Privacy Notice](https://www.google.com/chrome/privacy/), not by this policy.

## Permissions

- `storage`: saves the settings listed above.
- Access to all sites (content script on `<all_urls>`): text can be selected on any page, so
  the script that listens for a selection and shows the translation bubble has to be present
  on any page.

## Changes

Changes to this policy are published in this file, with the date above updated.

## Contact

Open an issue at <https://github.com/shaonianche/nanogloss/issues>.
