import { browser, defineBackground } from "#imports"

/**
 * The extension's two ways in.
 *
 * NanoGloss works from a text selection, and its default trigger is a gesture (Alt or a long
 * press), so a fresh install shows nothing until the user knows that gesture. The settings page
 * explains it and lists the language packs, so it opens once after installing, and the toolbar
 * button opens it again at any time.
 */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      void browser.runtime.openOptionsPage()
    }
  })

  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage()
  })
})
