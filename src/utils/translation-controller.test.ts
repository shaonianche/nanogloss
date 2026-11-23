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

    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({
      status: "done",
      translation: "Hello",
      runs: [{ kind: "text", text: "Hello" }],
    }))
    expect(states).toContainEqual({ status: "translating", partial: "Hel", runs: [{ kind: "text", text: "Hel" }] })
    expect(states).toContainEqual({ status: "translating", partial: "Hello", runs: [{ kind: "text", text: "Hello" }] })
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
      runs: [{ kind: "text", text: `<${first}>\n\n<${second}>` }],
    })
  })

  it("answers a repeated selection from the cache", async () => {
    const first = await select("Hallo zwei")
    await vi.waitFor(() => expect(first.controller.getSnapshot().state.status).toBe("done"))
    expect(translateStreaming).toHaveBeenCalledTimes(1)

    const again = await select("Hallo zwei")
    expect(again.controller.getSnapshot().state).toEqual({
      status: "done",
      translation: "<Hallo zwei>",
      runs: [{ kind: "text", text: "<Hallo zwei>" }],
    })
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

  it("suggests a retry when Chrome fails while the language pack downloads", async () => {
    availability.mockResolvedValue("downloadable")
    vi.stubGlobal("Translator", {
      availability: () => availability(),
      create: async () => {
        throw new Error("Unable to create translator")
      },
    })

    // Its own language pair: the module keeps one translator per pair, and the other tests
    // have already created the default one.
    const { controller } = await select("Bonjour quatre", "fr")
    await vi.waitFor(() => expect(controller.getSnapshot().state.status).toBe("error"))
    expect(controller.getSnapshot().state).toMatchObject({ reason: "failed", message: expect.stringContaining("try again") })
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
    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({
      status: "translating",
      partial: "Half",
      runs: [{ kind: "text", text: "Half" }],
    }))

    controller.cancel()
    await vi.waitFor(() => expect(aborted).toBe(true))
    expect(controller.getSnapshot().state).toEqual({ status: "idle" })
  })

  it("masks inline code and restores it in the final runs", async () => {
    translateStreaming.mockImplementation(text => streamOf([text.replace("Run", "运行")]))
    const controller = createSelectionTranslationController()
    await controller.select({
      segments: [
        { kind: "text", text: "Run " },
        { kind: "inline-code", text: "pnpm build" },
        { kind: "text", text: " now." },
      ],
      sourceLanguage: "en",
      documentLanguage: null,
      targetLanguage: "zh",
    })

    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({
      status: "done",
      translation: "运行 pnpm build now.",
      runs: [
        { kind: "text", text: "运行 " },
        { kind: "inline-code", text: "pnpm build" },
        { kind: "text", text: " now." },
      ],
    }))
    expect(translateStreaming).toHaveBeenCalledWith("Run ⟦0⟧ now.", expect.anything())
  })

  it("falls back to unmasked translation when the model drops a placeholder", async () => {
    translateStreaming
      .mockImplementationOnce(() => streamOf(["运行 now."]))
      .mockImplementationOnce(() => streamOf(["运行 pnpm build now."]))

    const controller = createSelectionTranslationController()
    await controller.select({
      segments: [
        { kind: "text", text: "Run " },
        { kind: "inline-code", text: "pnpm build" },
        { kind: "text", text: " now!" },
      ],
      sourceLanguage: "en",
      documentLanguage: null,
      targetLanguage: "zh",
    })

    await vi.waitFor(() => expect(controller.getSnapshot().state).toEqual({
      status: "done",
      translation: "运行 pnpm build now.",
      runs: [{ kind: "text", text: "运行 pnpm build now." }],
    }))
    expect(translateStreaming).toHaveBeenCalledTimes(2)
    expect(translateStreaming).toHaveBeenNthCalledWith(1, "Run ⟦0⟧ now!", expect.anything())
    expect(translateStreaming).toHaveBeenNthCalledWith(2, "Run pnpm build now!", expect.anything())
  })
})