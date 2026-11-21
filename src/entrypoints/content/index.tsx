import { defineContentScript } from "#imports"
import { getBuiltInTranslatorApi } from "@/utils/translator"
import { startSelectionTranslator } from "./selection-translator"
import "./style.css"

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  runAt: "document_idle",
  cssInjectionMode: "ui",

  main(ctx) {
    // Without the built-in translator there is no engine to run, so skip the listeners
    // instead of injecting a bubble that would fail on every selection. The options page
    // explains what the browser is missing.
    //
    // This also covers the frames Chrome never exposes the API in: it is limited to top-level
    // windows and same-origin iframes (a cross-origin iframe needs `allow="translator"` from
    // the embedding page, which is not ours to set), and Web Workers do not get it at all. With
    // `allFrames: true`, some frames therefore load this script and quietly do nothing.
    if (!getBuiltInTranslatorApi()) {
      return
    }

    startSelectionTranslator(ctx)
  },
})
