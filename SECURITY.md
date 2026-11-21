# Security Policy

## Supported versions

Only the latest release on the
[releases page](https://github.com/shaonianche/nanogloss/releases) receives security fixes.

## Reporting a vulnerability

Report it privately through
[GitHub's vulnerability reporting](https://github.com/shaonianche/nanogloss/security/advisories/new).
Do not open a public issue.

Include what the problem is, the steps to reproduce it, and the Chrome and extension versions.
You should get a first reply within 7 days.

## Scope

NanoGloss runs a content script on every page and reads the text the user selects. Reports of
particular interest:

- a page making the extension read, translate, or reveal content the user did not select;
- a page changing the extension's settings or reaching its extension pages;
- the extension sending data off the device.

Translation quality, and bugs in Chrome's Translator API itself, are out of scope: report the
latter to [Chromium](https://issues.chromium.org/).
