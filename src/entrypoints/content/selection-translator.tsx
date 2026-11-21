import { createRoot, type Root } from "react-dom/client"
import { enableShadowDOM } from "react-stately/private/flags/flags"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { createShadowRootUi, type ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root"
import { getDocumentLanguage, resolveLanguageCode } from "@/utils/languages"
import { DEFAULT_SETTINGS, settingsItem, type NanoglossSettings } from "@/utils/storage"
import { isDarkTheme } from "@/utils/theme"
import { createSelectionTranslationController } from "@/utils/translation-controller"
import { destroyTranslators } from "@/utils/translator"
import { readSelection, type SelectionSnapshot } from "./selection"
import { BUBBLE_MAX_WIDTH, BUBBLE_WIDTH_RATIO, SelectionBubble } from "./selection-bubble"

const BUBBLE_ESTIMATED_HEIGHT = 180
const BUBBLE_MARGIN = 8
const FALLBACK_TARGET_LANGUAGE = "en"

/** What opened the bubble: one of the two manual gestures, or a plain selection in `auto` mode. */
export type TriggerGesture = "alt" | "long-press" | "auto"

/**
 * What a host other than the content script supplies. The welcome page runs this same code over
 * its practice text, so what the user tries there is the real bubble; an extension page is not a
 * content script, though, which is what the first three are for.
 */
export interface SelectionTranslatorOptions {
  /**
   * The bubble's stylesheet. WXT fetches it for a content script (`cssInjectionMode: "ui"`), but
   * only for the content script entrypoint itself.
   */
  bubbleCss?: string
  /** Only selections that start inside this element count; the rest of the page is left alone. */
  scope?: HTMLElement
  /** Settings the host fixes for its own text, read on every use: they win over the stored ones. */
  overrideSettings?: () => Partial<NanoglossSettings>
  /** Called each time a gesture opens the bubble. */
  onBubbleShown?: (gesture: TriggerGesture) => void
  /** Called when a gesture's translation gets under way (not for a result from the cache). */
  onTranslating?: () => void
  /**
   * Called when that translation ends, with the time from the gesture to the finished result;
   * `null` when there is no time worth showing: a result from the cache, a failure, or a run
   * that downloads a language pack, which is reported as soon as the download shows.
   */
  onTranslated?: (milliseconds: number | null) => void
  /** Called when the bubble is dismissed, and on every press outside it. */
  onBubbleHidden?: () => void
}

/**
 * Listens for the selection gestures on this document and shows the translation bubble next to
 * the selection. Everything is released when `ctx` is invalidated. Returns a function that
 * dismisses the bubble, for a host whose own controls swallow the press that would do it.
 */
export function startSelectionTranslator(ctx: ContentScriptContext, options: SelectionTranslatorOptions = {}): () => void {
  // The bubble renders inside a shadow root, and React Aria (under every HeroUI component)
  // ignores shadow DOM unless told otherwise: its press handling compares the event target
  // with `Node.contains()`, which does not cross the shadow boundary, so a real click or key
  // press on a bubble button did nothing — "Download language pack" and "Try again" could not
  // be used. The flag is module state inside `react-stately`, so this import must resolve to
  // the copy `react-aria` uses: `package.json` pins the exact version `react-aria` depends on.
  enableShadowDOM()

  const controller = createSelectionTranslationController()

  let storedSettings: NanoglossSettings = DEFAULT_SETTINGS
  let currentSettings = storedSettings
  function applySettings(stored: NanoglossSettings) {
    storedSettings = stored
    currentSettings = { ...stored, ...options.overrideSettings?.() }
  }
  void settingsItem.getValue().then(applySettings)
  const unwatchSettings = settingsItem.watch(applySettings)

  // Times a translation for `onTranslated` the way the user experiences it: from the gesture
  // (for a long press, the moment the hold completes) to the finished result, creating the
  // translator included. Two cases have no time worth reporting. A result served
  // from the cache never reached the model. And a run that really downloaded a language pack
  // (progress seen strictly between 0 and 100) measured the network, not the model.
  let gestureStart: number | null = null
  let modelStarted = false
  const unsubscribeTiming = controller.subscribe(() => {
    const { state } = controller.getSnapshot()
    if (gestureStart === null) {
      return
    }
    if (state.status === "downloading" || state.status === "translating") {
      if (!modelStarted) {
        modelStarted = true
        options.onTranslating?.()
      }
      // A real download: this run measures the network, so it ends untimed here, and a host
      // showing a stopwatch stops it now instead of counting the download.
      if (state.status === "downloading" && state.percent > 0 && state.percent < 100) {
        options.onTranslated?.(null)
        gestureStart = null
      }
    }
    else if (state.status === "done") {
      options.onTranslated?.(modelStarted ? performance.now() - gestureStart : null)
      gestureStart = null
    }
    else if (state.status === "error") {
      // A retry from the bubble's button starts whenever the user gets to it.
      options.onTranslated?.(null)
      gestureStart = null
    }
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
      css: options.bubbleCss,
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
    gestureStart = null
    options.onBubbleHidden?.()
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
   * Follow the selection on scroll and on a window resize instead of dismissing: the bubble is
   * fixed-positioned, so without this it would float over whatever scrolls under it, and a
   * resize reflows the text while the bubble stays put (or ends up outside a window that got
   * smaller). Re-places at most once
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

  async function triggerBubble(selection: SelectionSnapshot, gesture: TriggerGesture): Promise<boolean> {
    const targetLanguage = resolveLanguageCode(currentSettings.targetLanguage) ?? FALLBACK_TARGET_LANGUAGE
    const sourceLanguage = currentSettings.sourceLanguage === "auto"
      ? null
      : resolveLanguageCode(currentSettings.sourceLanguage)

    // Before the controller is armed, so nothing can dismiss the selection between arming it
    // and mounting the bubble. Only the first call waits; later ones get the same UI back.
    const dismissalsBefore = dismissals
    gestureStart = performance.now()
    modelStarted = false
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
    options.onBubbleShown?.(gesture)
    return true
  }

  /** Whether the press that started the current gesture was inside `options.scope`. */
  let pressInScope = true

  function readScopedSelection(): SelectionSnapshot | null {
    if (options.scope) {
      // Judged by where the press and the selection start. The press, because a click on a
      // button elsewhere on the page leaves the earlier selection in place; the start, because
      // a triple click selects the paragraph up to the start of the next block, so its end
      // (and its common ancestor) can lie outside the scope.
      const selection = window.getSelection()
      if (!pressInScope || !selection?.rangeCount || !options.scope.contains(selection.getRangeAt(0).startContainer)) {
        return null
      }
    }
    return readSelection(currentSettings.minCharacters)
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
      const selection = readScopedSelection()
      if (!selection) {
        return
      }

      longPressTimer = null
      const shown = await triggerBubble(selection, "long-press")
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
    // Every gesture starts with a press, so this is where a host's override is picked up.
    applySettings(storedSettings)
    pressInScope = !options.scope || event.composedPath().includes(options.scope)
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
    // A host's own buttons swallow the press but not the release (React Aria stops the first
    // only), and the earlier selection is still in place: a release without its press is not a
    // selection gesture. Only for a host: on a web page the press can be hidden by the page
    // itself, and the selection made there still counts.
    if (options.scope && !pointerDown) {
      return
    }
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
      const selection = readScopedSelection()
      if (!selection) {
        hide()
        return
      }

      void triggerBubble(selection, currentSettings.triggerMode === "auto" ? "auto" : "alt")
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
  ctx.addEventListener(window, "resize", followSelection, { passive: true })

  // Release the translators (and their language packs) when this script instance is
  // replaced by an update or a reload.
  ctx.onInvalidated(() => {
    unwatchSettings()
    unsubscribeTiming()
    clearLongPressTimer()
    void destroyTranslators()
  })

  return hide
}
