import { defineContentScript } from "#imports"
import { createRoot, type Root } from "react-dom/client"
import { createShadowRootUi, type ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root"
import { getDocumentLanguage, resolveLanguageCode } from "@/utils/languages"
import { DEFAULT_SETTINGS, settingsItem, type NanoglossSettings } from "@/utils/storage"
import { isDarkTheme } from "@/utils/theme"
import { createSelectionTranslationController } from "@/utils/translation-controller"
import { destroyTranslators, getBuiltInTranslatorApi } from "@/utils/translator"
import { readSelection, type SelectionSnapshot } from "./selection"
import { BUBBLE_MAX_WIDTH, BUBBLE_WIDTH_RATIO, SelectionBubble } from "./selection-bubble"
import "./style.css"

const BUBBLE_ESTIMATED_HEIGHT = 180
const BUBBLE_MARGIN = 8
const FALLBACK_TARGET_LANGUAGE = "en"

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  runAt: "document_idle",
  cssInjectionMode: "ui",

  async main(ctx) {
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

    const controller = createSelectionTranslationController()

    let currentSettings: NanoglossSettings = DEFAULT_SETTINGS
    void settingsItem.getValue().then((s) => {
      currentSettings = s
    })
    const unwatchSettings = settingsItem.watch((next) => {
      currentSettings = next
    })

    /**
     * The bubble's shadow root, created by the first translation instead of at page load.
     *
     * This script runs in every frame of every page, and most of them never see a translation.
     * Creating the UI fetches the bubble's stylesheet (about 80 kB) and adds a host element to
     * the page, so both wait until there is a selection to show.
     */
    let ui: ShadowRootContentScriptUi<Root> | null = null
    let uiCreation: Promise<ShadowRootContentScriptUi<Root>> | null = null

    function ensureUi(): Promise<ShadowRootContentScriptUi<Root>> {
      uiCreation ??= createShadowRootUi(ctx, {
        name: "nanogloss-bubble",
        position: "inline",
        anchor: "body",
        isolateEvents: ["keydown", "keyup", "keypress", "mousedown", "mouseup"],
        onMount(uiContainer) {
          // The bubble is our own UI, so it follows the theme setting (which itself may follow
          // the system) instead of the page's: HeroUI switches themes through `data-theme`, and
          // a page that never sets it would leave the bubble in the light theme. Set per mount,
          // which is when a change would be visible.
          uiContainer.dataset.theme = isDarkTheme(currentSettings.theme) ? "dark" : "light"

          const root = createRoot(uiContainer)
          root.render(<SelectionBubble controller={controller} onDismiss={hide} onHeightChange={reportBubbleHeight} />)
          return root
        },
        onRemove(root) {
          root?.unmount()
        },
      }).then((created) => {
        ui = created
        return created
      })
      return uiCreation
    }

    function unmountUi() {
      if (ui?.mounted !== undefined) {
        ui.remove()
      }
    }

    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressTriggered = false
    let pointerDown = false
    let altLatched = false
    let lastClientX = 0
    let lastClientY = 0
    const JITTER_THRESHOLD_PX = 8

    function clearLongPressTimer() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    /** Counts dismissals, so a trigger that was waiting for the UI can tell it was dismissed meanwhile. */
    let dismissals = 0

    /** Hide the bubble and drop any in-flight translation. */
    function hide() {
      dismissals++
      clearLongPressTimer()
      longPressTriggered = false
      unmountUi()
      controller.cancel()
      // Chrome limits how many translators can exist at once, so release ours as soon as
      // the bubble is dismissed. Re-creating one is cheap once the language pack is on disk.
      // A language pack still downloading finishes first (see `destroyTranslators`).
      void destroyTranslators()
    }

    /**
     * Keep the bubble next to the selection, flipping above when there is no room below, and
     * never letting it leave the viewport.
     *
     * The styles go on `ui.uiContainer`, not on `ui.shadowHost`: WXT resets the host with
     * `:host { all: initial !important }` so page styles cannot reach into the shadow root,
     * and an important rule beats an inline style. Anything set on the host is therefore
     * discarded, leaving the bubble in the page's flow at the very bottom of the document.
     *
     * The height comes from the bubble's own report (`onHeightChange`), and `BUBBLE_ESTIMATED_HEIGHT`
     * is only the first guess, for the moment before the bubble has measured itself: a bubble
     * taller than the room below it would hang off the window, with its buttons unreachable.
     */
    function placeBubble(rect: DOMRect) {
      lastRect = rect
      if (!ui) {
        return
      }
      const container = ui.uiContainer
      const bubbleWidth = Math.min(window.innerWidth * BUBBLE_WIDTH_RATIO, BUBBLE_MAX_WIDTH)
      const maxLeft = Math.max(BUBBLE_MARGIN, window.innerWidth - bubbleWidth - BUBBLE_MARGIN)

      const height = bubbleHeight
      const spaceBelow = window.innerHeight - rect.bottom - BUBBLE_MARGIN
      const spaceAbove = rect.top - BUBBLE_MARGIN
      const placeBelow = spaceBelow >= height || spaceBelow >= spaceAbove
      const top = placeBelow ? rect.bottom + BUBBLE_MARGIN : rect.top - BUBBLE_MARGIN - height
      const maxTop = Math.max(BUBBLE_MARGIN, window.innerHeight - height - BUBBLE_MARGIN)

      container.style.position = "fixed"
      container.style.zIndex = "2147483647"
      container.style.left = `${Math.min(Math.max(BUBBLE_MARGIN, rect.left), maxLeft)}px`
      container.style.top = `${Math.min(Math.max(BUBBLE_MARGIN, top), maxTop)}px`
      container.style.transform = ""
      // The bubble grows out of the selection, so its entrance scales from the edge facing it.
      container.dataset.placement = placeBelow ? "below" : "above"
    }

    /** The bubble's measured height, reported by the bubble itself; the estimate until then. */
    let bubbleHeight = BUBBLE_ESTIMATED_HEIGHT

    /** The selection rect the bubble was last placed against. */
    let lastRect: DOMRect | null = null

    /**
     * The bubble grows and shrinks with its content (a streaming translation, a download progress
     * row), and its height decides where it fits: re-place it whenever a new size arrives.
     */
    function reportBubbleHeight(height: number) {
      bubbleHeight = height || BUBBLE_ESTIMATED_HEIGHT
      if (ui?.mounted !== undefined && lastRect) {
        placeBubble(lastRect)
      }
    }

    /**
     * Follow the selection on scroll instead of dismissing: the bubble is fixed-positioned,
     * so without this it would float over whatever scrolls under it. Re-places at most once
     * per frame; scroll events from the bubble's own ScrollShadow never reach `window`
     * (shadow-root isolation), so scrolling inside the bubble cannot trigger this.
     */
    let followFrame: number | null = null
    function followSelection() {
      if (followFrame !== null) {
        return
      }
      followFrame = window.requestAnimationFrame(() => {
        followFrame = null
        if (ui?.mounted === undefined) {
          return
        }
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          return
        }
        placeBubble(selection.getRangeAt(0).getBoundingClientRect())
      })
    }

    async function triggerBubble(selection: SelectionSnapshot): Promise<boolean> {
      const targetLanguage = resolveLanguageCode(currentSettings.targetLanguage) ?? FALLBACK_TARGET_LANGUAGE
      const sourceLanguage = currentSettings.sourceLanguage === "auto"
        ? null
        : resolveLanguageCode(currentSettings.sourceLanguage)

      // Before the controller is armed, so nothing can dismiss the selection between arming it
      // and mounting the bubble. Only the first call waits; later ones get the same UI back.
      const dismissalsBefore = dismissals
      const bubble = await ensureUi()
      if (dismissals !== dismissalsBefore) {
        return false
      }

      // The controller resolves an `auto` source and answers whether the selection is worth
      // showing; a same-language selection (or a superseded one) never mounts the bubble.
      const shouldShow = await controller.select({
        segments: selection.segments,
        sourceLanguage,
        documentLanguage: getDocumentLanguage(),
        targetLanguage,
      })
      if (!shouldShow) {
        return false
      }

      unmountUi()
      bubble.mount()
      placeBubble(selection.rect)
      return true
    }

    function isLongPressActive(): boolean {
      return currentSettings.triggerMode === "manual" && currentSettings.triggerLongPress
    }

    function startLongPressTimer() {
      clearLongPressTimer()
      if (!pointerDown || !isLongPressActive() || longPressTriggered) {
        return
      }

      const delay = currentSettings.longPressDelay
      longPressTimer = setTimeout(async () => {
        if (!pointerDown) {
          return
        }
        const selection = readSelection(currentSettings.minCharacters)
        if (!selection) {
          return
        }

        longPressTimer = null
        const shown = await triggerBubble(selection)
        if (shown) {
          longPressTriggered = true
        }
      }, delay)
    }

    function resetLongPressTimer() {
      clearLongPressTimer()
      if (pointerDown && isLongPressActive() && !longPressTriggered) {
        startLongPressTimer()
      }
    }

    ctx.addEventListener(document, "mousedown", (event) => {
      if (event.button !== 0) {
        return
      }
      pointerDown = true
      altLatched = event.altKey
      longPressTriggered = false
      lastClientX = event.clientX
      lastClientY = event.clientY

      if (!ui || !event.composedPath().includes(ui.shadowHost)) {
        hide()
      }

      if (isLongPressActive()) {
        resetLongPressTimer()
      }
    })

    ctx.addEventListener(document, "mousemove", (event) => {
      if (!pointerDown || !isLongPressActive() || longPressTriggered) {
        return
      }
      const dist = Math.hypot(event.clientX - lastClientX, event.clientY - lastClientY)
      if (dist > JITTER_THRESHOLD_PX) {
        lastClientX = event.clientX
        lastClientY = event.clientY
        resetLongPressTimer()
      }
    })

    ctx.addEventListener(document, "selectionchange", () => {
      if (pointerDown && isLongPressActive() && !longPressTriggered) {
        resetLongPressTimer()
      }
    })

    ctx.addEventListener(document, "mouseup", (event) => {
      clearLongPressTimer()

      const altHeld = altLatched || event.altKey
      pointerDown = false
      altLatched = false

      if (longPressTriggered) {
        longPressTriggered = false
        return
      }

      // In manual mode, mouseup triggers only if Alt was held and triggerAlt is enabled.
      // If only long-press was enabled in manual mode, or Alt was not held, do not trigger on mouseup.
      if (currentSettings.triggerMode === "manual" && (!currentSettings.triggerAlt || !altHeld)) {
        return
      }

      // The selection is finalised right before mouseup, but give the page one tick.
      window.setTimeout(() => {
        const selection = readSelection(currentSettings.minCharacters)
        if (!selection) {
          hide()
          return
        }

        void triggerBubble(selection)
      }, 0)
    })

    ctx.addEventListener(document, "keydown", (event) => {
      if (event.key === "Escape") {
        hide()
        return
      }
      if (pointerDown && event.altKey) {
        altLatched = true
      }
    })

    ctx.addEventListener(window, "scroll", followSelection, { capture: true, passive: true })

    // Release the translators (and their language packs) when this script instance is
    // replaced by an update or a reload.
    ctx.onInvalidated(() => {
      unwatchSettings()
      clearLongPressTimer()
      void destroyTranslators()
    })
  },
})