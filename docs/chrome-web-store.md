# Chrome Web Store submission

Text for the fields of the Developer Dashboard that are not in the package. The name and the
short description come from `public/_locales/*/messages.json`; the package comes from
`pnpm zip`.

## Single purpose

Translate text the user selects on a web page, on the device, with Chrome's built-in
Translator API.

## Permission justifications

**storage**

Saves the user's settings (source and target language, trigger mode, long-press delay, minimum
selection length, theme) in `chrome.storage.local`.

**Host permission (content script on `<all_urls>`)**

The extension translates text the user selects, and a selection can be made on any page. The
content script listens for the selection gesture, reads the selected text, and shows the
translation in a bubble next to it. It does not read unselected page content, does not modify
the page, and makes no network requests.

**Remote code**

No. All code is in the package.

## Data usage

The extension does not collect or transmit user data: select none of the data types on the
Privacy practices tab. The selected text ("website content") is processed on the device by
Chrome's Translator API and is never sent off the device or stored.

Certify all three statements:

- User data is not sold to third parties.
- User data is not used or transferred for purposes unrelated to the single purpose.
- User data is not used or transferred to determine creditworthiness or for lending.

## Privacy policy URL

<https://github.com/shaonianche/nanogloss/blob/main/PRIVACY.md>

The URL resolves once the repository is public.

## Listing

- Category: Tools
- Language: the package is localized in English, Japanese, Simplified Chinese, and Traditional
  Chinese; add a store description for each.
- Screenshots: 1280x800 or 640x400, at least one. Suggested: the bubble on an article, a
  language-pack download in the bubble, the settings page.
- State in the description that desktop Chrome 138 or newer is required.

## Notes for the reviewer

The default trigger is a gesture: hold Alt while selecting text, or keep the mouse button held
at the end of a selection. The first translation for a language pair downloads a language pack
through Chrome, which takes a few seconds.
