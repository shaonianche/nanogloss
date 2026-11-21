import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SupportedLanguageCode } from "./languages"
import { createSelectionTranslationController, type TranslationState } from "./translation-controller"

/**
 * The controller's flow against a stubbed Chrome. The real APIs only exist in a browser, and the
 * project verifies those in a real profile (`pnpm test:profile`); what is pinned down here is the
 * shape of the flow: availability first, then a streamed translation that can be chunked, cached
 * and cancelled.
 *
 * Every test uses its own text: the controller caches finished translations for the lifetime of
 * the module, so a shared string would leak between tests.
 */

const availability = vi.fn<() => Promise<string>>()
const translateStreaming = vi.fn<(text: string, options?: { signal?: AbortSignal }) => ReadableStream<string>>()

function streamOf(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

beforeEach(() => {
  availability.mockReset().mockResolvedValue("available")
  translateStreaming.mockReset().mockImplementation(text => streamOf([`<${text}>`]))
  vi.stubGlobal("Translator", {
    availability: () => availability(),
    create: async () => ({ translateStreaming, destroy: () => {} }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Runs one selection and collects every state the controller reported on the way. */
async function select(text: string, sourceLanguage: SupportedLanguageCode = "de", targetLanguage: SupportedLanguageCode = "en") {
  const controller = createSelectionTranslationController()
  const states: TranslationState[] = []
  controller.subscribe(() => states.push(controller.getSnapshot().state))

  const shown = await controller.select({
    segments: [{ kind: "text", text }],
    sourceLanguage,
    documentLanguage: null,
    targetLanguage,
  })
  return { controller, states, shown }
}

describe("createSelectionTranslationController", () => {
  it("reports the translation while it streams", async () => {
    translateStreaming.mockImplementation(() => streamOf(["Hel", "lo"]))
    const { controller, states } = await select("Hallo eins")

    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({ status: "done", translation: "Hello" }))
    expect(states).toContainEqual({ status: "translating", partial: "Hel" })
    expect(states).toContainEqual({ status: "translating", partial: "Hello" })
  })

  it("asks for one request per paragraph of a long selection", async () => {
    const first = "x".repeat(400)
    const second = "y".repeat(400)
    const { controller } = await select(`${first}\n\n${second}`)

    await vi.waitFor(() => expect(controller.getSnapshot().state.status).toBe("done"))
    expect(translateStreaming).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().state).toEqual({
      status: "done",
      translation: `<${first}>\n\n<${second}>`,
    })
  })

  it("answers a repeated selection from the cache", async () => {
    const first = await select("Hallo zwei")
    await vi.waitFor(() => expect(first.controller.getSnapshot().state.status).toBe("done"))
    expect(translateStreaming).toHaveBeenCalledTimes(1)

    const again = await select("Hallo zwei")
    expect(again.controller.getSnapshot().state).toEqual({ status: "done", translation: "<Hallo zwei>" })
    expect(translateStreaming).toHaveBeenCalledTimes(1)
  })

  it("reports a text whose language nobody could tell as an unknown source", async () => {
    // No LanguageDetector in this environment, and no document language to fall back to.
    const controller = createSelectionTranslationController()
    await controller.select({
      segments: [{ kind: "text", text: "?? ??" }],
      sourceLanguage: null,
      documentLanguage: null,
      targetLanguage: "en",
    })

    await vi.waitFor(() => expect(controller.getSnapshot().state).toMatchObject({ status: "error", reason: "unknown-source" }))
    expect(translateStreaming).not.toHaveBeenCalled()
  })

  it("stops the stream when the bubble is dismissed", async () => {
    let aborted = false
    translateStreaming.mockImplementation((_text, options) => new ReadableStream({
      start(controller) {
        controller.enqueue("Half")
        options?.signal?.addEventListener("abort", () => {
          aborted = true
          controller.error(new DOMException("Aborted", "AbortError"))
        })
      },
    }))

    const { controller } = await select("Hallo drei")
    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({ status: "translating", partial: "Half" }))

    controller.cancel()
    await vi.waitFor(() => expect(aborted).toBe(true))
    expect(controller.getSnapshot().state).toEqual({ status: "idle" })
  })
})