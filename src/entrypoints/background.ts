import { browser, defineBackground } from "#imports"

/**
 * The extension's two ways in.
 *
 * NanoGloss works from a text selection, and its default trigger is a gesture (Alt or a long
 * press), so a fresh install shows nothing until the user knows that gesture. Installing
 * therefore opens the welcome page once: a practice page with a guided tour that checks the
 * browser, sets the languages and has the user try each trigger. The toolbar button opens the
 * settings page at any time, which links back to the welcome page.
 */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      void browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") })
    }
  })

  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage()
  })
})
