import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { ContentScriptContext } from "wxt/utils/content-script-context"
import { DEFAULT_SETTINGS, settingsItem, type NanoglossSettings } from "@/utils/storage"
import contentScript from "./index"
import { startSelectionTranslator, type TriggerGesture } from "./selection-translator"

/**
 * The content script's gestures and placement, driven through the DOM events a user produces.
 *
 * The bubble itself is not rendered: WXT's shadow-root UI is replaced by a stand-in that records
 * whether it is mounted and exposes the container the script positions. What is pinned down is
 * which gesture opens the bubble, what dismisses it, and where it is placed.
 */
const bubble = vi.hoisted(() => ({
  mounted: false,
  /** How many times the bubble was opened. */
  mounts: 0,
  host: null as HTMLElement | null,
  container: null as HTMLElement | null,
}))

vi.mock("wxt/utils/content-script-ui/shadow-root", () => ({
  createShadowRootUi: async () => {
    const host = document.createElement("nanogloss-bubble")
    const container = document.createElement("div")
    document.body.append(host)
    bubble.host = host
    bubble.container = container
    return {
      shadowHost: host,
      uiContainer: container,
      get mounted() {
        return bubble.mounted ? {} : undefined
      },
      mount() {
        bubble.mounted = true
        bubble.mounts++
      },
      remove() {
        bubble.mounted = false
      },
    }
  },
}))

/** jsdom's window: 1024 x 768. */
const VIEWPORT = { width: 1024, height: 768 }

let selectionRect = rectAt(100, 100)
let ctx: ContentScriptContext

function rectAt(left: number, top: number, width = 200, height = 20): DOMRect {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect
}

async function start(settings: Partial<NanoglossSettings> = {}) {
  // A fixed source language, so no test waits on the language detector.
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", ...settings })
  ctx = new ContentScriptContext("content")
  await contentScript.main(ctx)
  await vi.advanceTimersByTimeAsync(0)
}

function selectParagraph() {
  const range = document.createRange()
  range.selectNodeContents(document.querySelector("p")!)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function mouse(type: "mousedown" | "mouseup", init: MouseEventInit = {}, target: EventTarget = document) {
  target.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true, composed: true, ...init }))
}

/** A drag over the paragraph: press, select, release. */
async function dragSelect(init: MouseEventInit = {}) {
  mouse("mousedown", init)
  selectParagraph()
  mouse("mouseup", init)
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  fakeBrowser.reset()
  bubble.mounted = false
  bubble.mounts = 0
  selectionRect = rectAt(100, 100)
  document.body.innerHTML = "<p>Die maschinelle Übersetzung hat sich enorm verbessert.</p>"
  Range.prototype.getBoundingClientRect = () => selectionRect
  vi.stubGlobal("Translator", {
    availability: async () => "available",
    create: async () => ({
      translateStreaming: () => new ReadableStream<string>({ start: controller => controller.close() }),
      destroy: () => {},
    }),
  })
})

afterEach(() => {
  ctx.abort()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("trigger gestures", () => {
  it("ignores a plain selection in manual mode", async () => {
    await start({ triggerMode: "manual" })
    await dragSelect()
    expect(bubble.mounted).toBe(false)
  })

  it("opens the bubble for a selection made with Alt held", async () => {
    await start({ triggerMode: "manual", triggerAlt: true })
    await dragSelect({ altKey: true })
    expect(bubble.mounted).toBe(true)
  })

  it("ignores Alt when the Alt gesture is turned off", async () => {
    await start({ triggerMode: "manual", triggerAlt: false, triggerLongPress: true })
    await dragSelect({ altKey: true })
    expect(bubble.mounted).toBe(false)
  })

  it("opens the bubble for every selection in auto mode", async () => {
    await start({ triggerMode: "auto" })
    await dragSelect()
    expect(bubble.mounted).toBe(true)
  })

  it("opens the bubble once the button has been held for the long-press delay", async () => {
    await start({ triggerMode: "manual", triggerAlt: false, triggerLongPress: true, longPressDelay: 800 })
    mouse("mousedown")
    selectParagraph()
    document.dispatchEvent(new Event("selectionchange"))

    await vi.advanceTimersByTimeAsync(799)
    expect(bubble.mounted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(bubble.mounted).toBe(true)
  })

  /**
   * With both gestures on, a long press made with Alt held satisfies both. Releasing the button
   * ends the long press; it must not run the Alt gesture too and open the bubble a second time,
   * which would restart a translation that is already streaming.
   */
  it("opens the bubble once when a long press is made with Alt held", async () => {
    await start({ triggerMode: "manual", triggerAlt: true, triggerLongPress: true, longPressDelay: 800 })
    mouse("mousedown", { altKey: true })
    selectParagraph()
    document.dispatchEvent(new Event("selectionchange"))
    await vi.advanceTimersByTimeAsync(800)
    expect(bubble.mounts).toBe(1)

    mouse("mouseup", { altKey: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounts).toBe(1)
    expect(bubble.mounted).toBe(true)
  })

  it("does not open the bubble when the button is released before the delay", async () => {
    await start({ triggerMode: "manual", triggerAlt: false, triggerLongPress: true, longPressDelay: 800 })
    mouse("mousedown")
    selectParagraph()
    document.dispatchEvent(new Event("selectionchange"))
    await vi.advanceTimersByTimeAsync(500)
    mouse("mouseup")

    await vi.advanceTimersByTimeAsync(1000)
    expect(bubble.mounted).toBe(false)
  })

  it("does not create the bubble's UI before the first translation", async () => {
    document.querySelector("nanogloss-bubble")?.remove()
    await start({ triggerMode: "manual" })
    await dragSelect()
    expect(document.querySelector("nanogloss-bubble")).toBeNull()

    await dragSelect({ altKey: true })
    expect(document.querySelector("nanogloss-bubble")).not.toBeNull()
  })
})

describe("dismissal", () => {
  beforeEach(async () => {
    await start({ triggerMode: "auto" })
    await dragSelect()
  })

  it("closes the bubble on a press outside it", () => {
    expect(bubble.mounted).toBe(true)
    mouse("mousedown")
    expect(bubble.mounted).toBe(false)
  })

  it("keeps the bubble on a press inside it", () => {
    mouse("mousedown", {}, bubble.host!)
    expect(bubble.mounted).toBe(true)
  })

  it("closes the bubble on Escape", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(bubble.mounted).toBe(false)
  })
})

/** Opens the bubble for a selection at `rect` and returns where the script put it. */
async function placeAt(rect: DOMRect) {
  selectionRect = rect
  await start({ triggerMode: "auto" })
  await dragSelect()
  const { style, dataset } = bubble.container!
  return { left: Number.parseFloat(style.left), top: Number.parseFloat(style.top), placement: dataset.placement }
}

describe("placement", () => {
  it("places the bubble below the selection, aligned with its left edge", async () => {
    expect(await placeAt(rectAt(100, 100))).toEqual({ left: 100, top: 128, placement: "below" })
  })

  it("flips above a selection that has no room below it", async () => {
    const placed = await placeAt(rectAt(100, 700))
    expect(placed.placement).toBe("above")
    // The bubble's bottom edge sits one margin above the selection.
    expect(placed.top).toBeLessThan(700)
  })

  // The bubble is fixed-positioned, so it has to be moved by hand when the text under it moves.
  it.each(["scroll", "resize"])("follows the selection on a window %s", async (type) => {
    await placeAt(rectAt(100, 100))

    selectionRect = rectAt(300, 400)
    window.dispatchEvent(new Event(type))
    await vi.advanceTimersToNextFrame()

    const { style } = bubble.container!
    expect({ left: style.left, top: style.top }).toEqual({ left: "300px", top: "428px" })
  })

  it("keeps the bubble inside the window for a selection at the right edge", async () => {
    const placed = await placeAt(rectAt(1000, 100, 20))
    const bubbleWidth = VIEWPORT.width * 0.6
    expect(placed.left + bubbleWidth).toBeLessThanOrEqual(VIEWPORT.width - 8)
  })
})

async function startHosted(settings: Partial<NanoglossSettings>, scope?: HTMLElement) {
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", ...settings })
  const gestures: TriggerGesture[] = []
  ctx = new ContentScriptContext("hosted")
  startSelectionTranslator(ctx, { scope, onBubbleShown: gesture => gestures.push(gesture) })
  await vi.advanceTimersByTimeAsync(0)
  return gestures
}

/** The welcome page runs the same code over its practice text. */
describe("hosted outside the content script", () => {
  it("reports which gesture opened the bubble", async () => {
    const gestures = await startHosted({ triggerMode: "manual", longPressDelay: 800 })
    await dragSelect({ altKey: true })
    mouse("mousedown")
    selectParagraph()
    await vi.advanceTimersByTimeAsync(800)
    mouse("mouseup")
    expect(gestures).toEqual(["alt", "long-press"])

    await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", triggerMode: "auto" })
    await dragSelect()
    expect(gestures).toEqual(["alt", "long-press", "auto"])
  })

  it("ignores a selection outside its scope", async () => {
    document.body.insertAdjacentHTML("beforeend", "<section>Übung macht den Meister, sagt man.</section>")
    const scope = document.querySelector("section")!
    const gestures = await startHosted({ triggerMode: "auto" }, scope)

    await dragSelect()
    expect(bubble.mounted).toBe(false)

    mouse("mousedown", {}, scope)
    window.getSelection()!.selectAllChildren(scope)
    mouse("mouseup")
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounted).toBe(true)
    expect(gestures).toEqual(["auto"])
  })

  it("ignores a press outside its scope that leaves a selection inside it", async () => {
    document.body.insertAdjacentHTML("beforeend", "<section>Übung macht den Meister, sagt man.</section><button>Weiter</button>")
    const scope = document.querySelector("section")!
    await startHosted({ triggerMode: "auto" }, scope)
    window.getSelection()!.selectAllChildren(scope)

    const button = document.querySelector("button")!
    mouse("mousedown", {}, button)
    mouse("mouseup", {}, button)
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounted).toBe(false)
  })

  it("lets the host override stored settings, read again on each press", async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", triggerMode: "manual" })
    let override: Partial<NanoglossSettings> = {}
    ctx = new ContentScriptContext("hosted")
    startSelectionTranslator(ctx, { overrideSettings: () => override })
    await vi.advanceTimersByTimeAsync(0)

    await dragSelect()
    expect(bubble.mounted).toBe(false)

    override = { triggerMode: "auto" }
    await dragSelect()
    expect(bubble.mounted).toBe(true)
    expect((await settingsItem.getValue()).triggerMode).toBe("manual")
  })

  it("reports a time for a translation the model ran, and none for one from the cache", async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", triggerMode: "auto" })
    const times: (number | null)[] = []
    ctx = new ContentScriptContext("hosted")
    startSelectionTranslator(ctx, { onTranslated: milliseconds => times.push(milliseconds) })
    await vi.advanceTimersByTimeAsync(0)
    // The translation cache is shared by the whole file, so this needs a text of its own.
    document.querySelector("p")!.textContent = "Wie lange hat das gedauert?"

    await dragSelect()
    await vi.advanceTimersByTimeAsync(0)
    await dragSelect()
    await vi.advanceTimersByTimeAsync(0)
    expect(times).toEqual([expect.any(Number), null])
  })

  it("ignores a release whose press it never saw", async () => {
    // A HeroUI button swallows the press but not the release, and the earlier selection is
    // still there: without the press, the release must not count as a new selection.
    document.body.insertAdjacentHTML("beforeend", "<section>Übung macht den Meister, sagt man.</section>")
    const scope = document.querySelector("section")!
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, sourceLanguage: "de", targetLanguage: "en", triggerMode: "auto" })
    ctx = new ContentScriptContext("hosted")
    const dismiss = startSelectionTranslator(ctx, { scope })
    await vi.advanceTimersByTimeAsync(0)

    mouse("mousedown", {}, scope)
    window.getSelection()!.selectAllChildren(scope)
    mouse("mouseup")
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounted).toBe(true)

    dismiss()
    mouse("mouseup")
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounted).toBe(false)
  })

  it("accepts a triple click, whose selection ends past the scope", async () => {
    document.body.insertAdjacentHTML("beforeend", "<div><section>Übung macht den Meister, sagt man.</section><footer>Fuß</footer></div>")
    const scope = document.querySelector("section")!
    await startHosted({ triggerMode: "auto" }, scope)

    mouse("mousedown", {}, scope)
    const range = document.createRange()
    range.setStart(scope.firstChild!, 0)
    range.setEnd(document.querySelector("footer")!, 0)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    mouse("mouseup")
    await vi.advanceTimersByTimeAsync(0)
    expect(bubble.mounted).toBe(true)
  })
})
