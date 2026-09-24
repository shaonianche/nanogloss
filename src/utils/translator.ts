/**
 * Minimal typed surface for Chrome's built-in Translator API.
 *
 * The API is not part of `lib.dom` yet, so the global is accessed through a cast
 * instead of relying on ambient types. Once the shape stabilises, swap this for
 * `@types/dom-chromium-ai` (recommended by the Chrome docs).
 *
 * Verified behaviour (Chrome 154, desktop):
 * - available in content scripts, extension pages **and** the MV3 service worker;
 * - `availability()` reports `available` once the language pack is on disk, and
 *   `downloadable` / `downloading` while it still has to be fetched;
 * - the first `create()` for a pair needs a user gesture in documents
 *   (`NotAllowedError` otherwise), but no gesture is needed from a service worker;
 * - translations are processed sequentially by the browser;
 * - a first translation downloads a language pack (~4 s on a fast connection),
 *   reported through the `downloadprogress` event as a 0…1 fraction.
 *
 * @see https://developer.chrome.com/docs/ai/translator-api
 */
export type TranslatorAvailability = "available" | "downloadable" | "downloading" | "unavailable"

export interface TranslatorDownloadProgressEvent extends Event {
  loaded: number
  total: number
}

export interface BuiltInTranslator {
  translate: (text: string) => Promise<string>
  translateStreaming: (text: string) => AsyncIterable<string>
  destroy: () => void
}

export interface BuiltInTranslatorApi {
  availability: (options: { sourceLanguage: string, targetLanguage: string }) => Promise<TranslatorAvailability>
  create: (options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }) => Promise<BuiltInTranslator>
}

export interface BuiltInLanguageDetector {
  detect: (text: string) => Promise<Array<{ detectedLanguage: string, confidence: number }>>
}

export interface BuiltInLanguageDetectorApi {
  availability: () => Promise<TranslatorAvailability>
  create: () => Promise<BuiltInLanguageDetector>
}

export type TranslatorFailureReason = "unsupported-pair" | "needs-user-gesture" | "failed"

export interface TranslatorFailure {
  reason: TranslatorFailureReason
  message: string
}

/** Returns the built-in translator when the browser exposes it, otherwise `null`. */
export function getBuiltInTranslatorApi(): BuiltInTranslatorApi | null {
  const candidate = (globalThis as { Translator?: BuiltInTranslatorApi }).Translator
  return candidate ?? null
}

export function getBuiltInLanguageDetectorApi(): BuiltInLanguageDetectorApi | null {
  const candidate = (globalThis as { LanguageDetector?: BuiltInLanguageDetectorApi }).LanguageDetector
  return candidate ?? null
}

export function toTranslatorFailure(error: unknown): TranslatorFailure {
  const name = (error as { name?: string } | null)?.name
  const message = error instanceof Error ? error.message : String(error)

  if (name === "NotAllowedError") {
    return { reason: "needs-user-gesture", message }
  }

  // Chrome caps how many translators can exist at once ("The translation service count
  // exceeded the limitation"), usually because many tabs each created one.
  if (/exceeded the limitation|translation service count/i.test(message)) {
    return {
      reason: "failed",
      message: "Chrome reached its limit for on-device translation. Close a few tabs and try again.",
    }
  }

  return { reason: "failed", message }
}

/* ──────────────────────────────
  Translator instances
  ────────────────────────────── */

/**
 * One translator per language pair is enough: the browser serialises translations
 * anyway, and creating one costs a language-pack download the first time.
 */
const translatorPromises = new Map<string, Promise<BuiltInTranslator>>()

function pairKey(sourceLanguage: string, targetLanguage: string) {
  return `${sourceLanguage}->${targetLanguage}`
}

export interface GetTranslatorOptions {
  sourceLanguage: string
  targetLanguage: string
  /** Called with 0…100 while the language pack is being fetched. */
  onDownloadProgress?: (percent: number) => void
}

export async function getTranslator(options: GetTranslatorOptions): Promise<BuiltInTranslator> {
  const api = getBuiltInTranslatorApi()
  if (!api) {
    throw new Error("The built-in Translator API is not available in this browser")
  }

  const key = pairKey(options.sourceLanguage, options.targetLanguage)
  const existing = translatorPromises.get(key)
  if (existing) {
    return existing
  }

  const created = api
    .create({
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const { loaded, total } = event as TranslatorDownloadProgressEvent
          const percent = total > 0 ? (loaded / total) * 100 : loaded * 100
          options.onDownloadProgress?.(Math.min(100, Math.max(0, Math.round(percent))))
        })
      },
    })
    .catch((error) => {
      // Do not cache a failed creation: the next attempt (usually with a user gesture)
      // should be able to try again.
      translatorPromises.delete(key)
      throw error
    })

  translatorPromises.set(key, created)
  return created
}

export function destroyTranslators(): void {
  for (const promise of translatorPromises.values()) {
    void promise.then(translator => translator.destroy()).catch(() => {})
  }
  translatorPromises.clear()
}

/**
 * Availability of the on-device model for `code`, probed through both pivot directions.
 *
 * A pack counts as available when EITHER direction is: Chrome reports the two directions
 * independently, and requiring both gives false negatives. Verified against the on-disk
 * state of a real profile: with `TranslateKit/models/de_en` fully present (both
 * `de_en_nmt` and `en_de_nmt`), `availability()` reported en→de as `available` but de→en
 * as `downloadable`.
 *
 * The probe has a blind spot either way: packs left behind by an older Chrome sit on disk
 * yet report `downloadable` (Chrome re-downloads them before use), and no Web API can tell
 * them apart from "never installed".
 *
 * The answer also depends on the calling context: an extension page sees packs that a web
 * page does not. Verified in one and the same profile — en→hu reported `available` on the
 * options page but `downloadable` on an http page, same model files on disk (most likely
 * anti-fingerprinting: a web page must not learn which languages the user has installed).
 * The options page therefore reads the truth for the extension's own usage; a content
 * script may still be offered a download for a pack this function calls available.
 *
 * "Either direction available" is the most accurate "ready for instant translation"
 * signal the platform exposes.
 */
export async function getLanguagePackAvailability(code: string): Promise<TranslatorAvailability> {
  const api = getBuiltInTranslatorApi()
  if (!api) {
    return "unavailable"
  }
  if (code === "en") {
    return "available"
  }

  const [enToCode, codeToEn] = await Promise.all([
    api.availability({ sourceLanguage: "en", targetLanguage: code }),
    api.availability({ sourceLanguage: code, targetLanguage: "en" }),
  ])

  if (enToCode === "available" || codeToEn === "available") {
    return "available"
  }
  if (enToCode === "downloading" || codeToEn === "downloading") {
    return "downloading"
  }
  if (enToCode === "unavailable" && codeToEn === "unavailable") {
    return "unavailable"
  }
  return "downloadable"
}

/**
 * Waits until Chrome reports a pair as `available` (giving up silently after `timeoutMs`).
 *
 * `create()` can resolve before the language model is fully installed, and destroying the
 * translator at that moment leaves the pair stuck on `downloadable`: the model ends up on
 * disk, but Chrome never marks it ready, so the UI keeps offering a download that has
 * already happened. Let the model settle before releasing the instance, then re-read the
 * availability instead of trusting the wait — a timeout here says nothing either way.
 */
export async function waitForTranslatorAvailability(options: {
  sourceLanguage: string
  targetLanguage: string
  timeoutMs?: number
}): Promise<void> {
  const api = getBuiltInTranslatorApi()
  if (!api) {
    return
  }

  const deadline = Date.now() + (options.timeoutMs ?? 30000)
  for (;;) {
    try {
      const availability = await api.availability({
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      })
      if (availability === "available") {
        return
      }
    }
    catch {
      return
    }

    if (Date.now() >= deadline) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 400))
  }
}

/* ──────────────────────────────
  Language detection (fallback for `auto` on pages without a declared language)
  ────────────────────────────── */

let detectorPromise: Promise<BuiltInLanguageDetector> | null = null

/**
 * Detects the language of `text` with Chrome's built-in Language Detector.
 * Returns `null` when the API is missing or detection is not possible.
 */
export async function detectLanguage(text: string): Promise<string | null> {
  const api = getBuiltInLanguageDetectorApi()
  if (!api) {
    return null
  }

  try {
    if (await api.availability() === "unavailable") {
      return null
    }

    detectorPromise ??= api.create().catch((error) => {
      detectorPromise = null
      throw error
    })

    const detector = await detectorPromise
    const [best] = await detector.detect(text)
    return best?.detectedLanguage ?? null
  }
  catch {
    return null
  }
}