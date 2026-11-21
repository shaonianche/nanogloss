import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { destroyTranslators, detectLanguage, getTranslator } from "./translator"

/**
 * `detectLanguage` is the part of the translator utilities that can be tested without Chrome:
 * it is a thin wrapper around the `LanguageDetector` global, and the behaviour worth pinning
 * down is what it does when that global is missing, slow or broken. Everything else in this
 * module talks to the real APIs and is verified in a real profile (`pnpm test:profile`).
 *
 * The module caches one detector for its whole lifetime, so these tests share a single stub and
 * drive the per-test behaviour through `availability` and the `detect` mock.
 */

const detect = vi.fn<(text: string) => Promise<Array<{ detectedLanguage: string, confidence: number }>>>()
let availability: () => Promise<string> = async () => "available"

beforeEach(() => {
  detect.mockReset()
  availability = async () => "available"
  vi.stubGlobal("LanguageDetector", {
    availability: () => availability(),
    create: async () => ({ detect }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("detectLanguage", () => {
  it("returns null when the browser has no LanguageDetector", async () => {
    vi.stubGlobal("LanguageDetector", undefined)
    await expect(detectLanguage("Hallo")).resolves.toBeNull()
  })

  it("returns the detected language", async () => {
    detect.mockResolvedValue([{ detectedLanguage: "de", confidence: 0.9 }, { detectedLanguage: "nl", confidence: 0.1 }])
    await expect(detectLanguage("Hallo")).resolves.toBe("de")
  })

  /**
   * The detector ranks every language for any input, so a short selection still gets a "best"
   * language. Acting on it would translate from the wrong language, or skip the selection as
   * already being in the target language.
   */
  it("returns null when the best guess does not outweigh the others", async () => {
    detect.mockResolvedValue([{ detectedLanguage: "zh", confidence: 0.4 }, { detectedLanguage: "ja", confidence: 0.35 }])
    await expect(detectLanguage("東京")).resolves.toBeNull()
  })

  it("returns null when detection is unavailable", async () => {
    availability = async () => "unavailable"
    await expect(detectLanguage("Hallo")).resolves.toBeNull()
    expect(detect).not.toHaveBeenCalled()
  })

  /**
   * Chrome can leave the detector's first `create()` pending while its model still has to be
   * downloaded, and the document cannot start that download without a user gesture — verified
   * in a real profile, where `create()` neither resolved nor rejected within 8 s. Detection runs
   * before the bubble mounts, so the wait is capped; a `detect()` that never answers looks the
   * same from here and must time out the same way.
   */
  it("gives up when the detector does not answer in time", async () => {
    detect.mockImplementation(() => new Promise(() => {}))
    await expect(detectLanguage("Hallo", 50)).resolves.toBeNull()
  })
})
describe("destroyTranslators", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * The bubble releases its translators on every dismissal, and any click on the page dismisses
   * it — also while a language pack is downloading. Destroying a translator before Chrome marks
   * its pair `available` leaves the pack on disk but reported as `downloadable` for good.
   */
  it("keeps a translator alive until its language pack has settled", async () => {
    vi.useFakeTimers()
    const destroy = vi.fn<() => void>()
    let pairAvailability = "downloading"
    vi.stubGlobal("Translator", {
      availability: async () => pairAvailability,
      create: async () => ({ destroy }),
    })

    await getTranslator({ sourceLanguage: "de", targetLanguage: "en" })
    const destroyed = destroyTranslators()

    await vi.advanceTimersByTimeAsync(2000)
    expect(destroy).not.toHaveBeenCalled()

    pairAvailability = "available"
    await vi.advanceTimersByTimeAsync(400)
    await destroyed
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
