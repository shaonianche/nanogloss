import { t } from "./i18n"

/**
 * Typed surface for Chrome's built-in Translator and Language Detector APIs.
 *
 * The `Translator` / `LanguageDetector` globals and their types come from
 * `@types/dom-chromium-ai`, the package the Chrome docs recommend. It is listed in
 * `tsconfig.json`'s `types`, because TypeScript 7 no longer includes `@types` packages
 * automatically.
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
 * @see https://developer.chrome.com/docs/ai/language-detection
 */
export type TranslatorAvailability = Availability

export type TranslatorFailureReason = "unsupported-pair" | "needs-user-gesture" | "failed"

export interface TranslatorFailure {
  reason: TranslatorFailureReason
  message: string
}

/** Returns the built-in translator when the browser exposes it, otherwise `null`. */
export function getBuiltInTranslatorApi(): typeof Translator | null {
  return typeof Translator === "undefined" ? null : Translator
}

export function getBuiltInLanguageDetectorApi(): typeof LanguageDetector | null {
  return typeof LanguageDetector === "undefined" ? null : LanguageDetector
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
      message: t("errorServiceLimitReached"),
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
interface CachedTranslator {
  sourceLanguage: string
  targetLanguage: string
  promise: Promise<Translator>
}

const cachedTranslators = new Map<string, CachedTranslator>()

function pairKey(sourceLanguage: string, targetLanguage: string) {
  return `${sourceLanguage}->${targetLanguage}`
}

export interface GetTranslatorOptions {
  sourceLanguage: string
  targetLanguage: string
  /** Called with 0…100 while the language pack is being fetched. */
  onDownloadProgress?: (percent: number) => void
}

export async function getTranslator(options: GetTranslatorOptions): Promise<Translator> {
  const api = getBuiltInTranslatorApi()
  if (!api) {
    throw new Error("The built-in Translator API is not available in this browser")
  }

  const key = pairKey(options.sourceLanguage, options.targetLanguage)
  const existing = cachedTranslators.get(key)
  if (existing) {
    return existing.promise
  }

  const created = api
    .create({
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const { loaded, total } = event
          const percent = total > 0 ? (loaded / total) * 100 : loaded * 100
          options.onDownloadProgress?.(Math.min(100, Math.max(0, Math.round(percent))))
        })
      },
    })
    .catch((error) => {
      // Do not cache a failed creation: the next attempt (usually with a user gesture)
      // should be able to try again.
      cachedTranslators.delete(key)
      throw error
    })

  cachedTranslators.set(key, { sourceLanguage: options.sourceLanguage, targetLanguage: options.targetLanguage, promise: created })
  return created
}

/**
 * Releases every translator, each one only after its language model has settled.
 *
 * Chrome caps how many translators can exist at once, so callers release theirs as soon as they
 * are done. But `create()` can resolve before the model is fully installed, and destroying the
 * translator at that moment leaves the pair stuck on `downloadable`: the model ends up on disk,
 * but Chrome never marks it ready, so the UI keeps offering a download that has already
 * happened. A caller cannot know whether a download is in flight — the bubble is dismissed by
 * any click on the page — so the wait lives here, for every caller.
 *
 * The cache is emptied right away, so the next request creates its own translator. Resolves
 * once every translator is destroyed.
 */
export async function destroyTranslators(): Promise<void> {
  const released = [...cachedTranslators.values()]
  cachedTranslators.clear()

  await Promise.all(released.map(async ({ sourceLanguage, targetLanguage, promise }) => {
    try {
      const translator = await promise
      await waitForTranslatorAvailability({ sourceLanguage, targetLanguage })
      translator.destroy()
    }
    catch {
      // A creation that failed left nothing to destroy.
    }
  }))
}

/**
 * Streams one translation, a delta at a time.
 *
 * The Chrome docs recommend the streaming call for long text: the reader sees the first words
 * while the model is still working on the rest. `translateStreaming()` returns a `ReadableStream`
 * and this walks it with a reader — `for await` over a stream would need the `DOM.AsyncIterable`
 * lib, which the generated tsconfig does not include — so the caller gets a plain async iterator
 * that ends when the stream does and rejects when the request is aborted.
 */
export async function* streamTranslation(
  translator: Translator,
  text: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const reader = translator.translateStreaming(text, { signal }).getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  }
  finally {
    reader.releaseLock()
  }
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
 * The answer also depends on the calling context, and the docs say why: Chrome hides a pair's
 * download state per site to protect privacy, so every pair reports `downloadable` until that
 * site has created a translator for it (Translator API docs, "Model download"). Verified in
 * one and the same profile — en→hu reported `available` on the options page but
 * `downloadable` on an http page, same model files on disk. The options page therefore reads
 * the truth for the extension's own usage; a content script may still be offered a download
 * for a pack this function calls available.
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
 * Waits until Chrome reports a pair as `available`, giving up silently after `timeoutMs`: a
 * timeout says nothing either way, so callers that need the answer re-read the availability.
 */
async function waitForTranslatorAvailability(options: {
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

let detectorPromise: Promise<LanguageDetector> | null = null

/**
 * Detects the language of `text` with Chrome's built-in Language Detector.
 * Returns `null` when the API is missing or detection is not possible.
 *
 * The wait is capped: the detector's first `create()` can stay pending for a long time
 * (verified on Chrome 154 — with the model still `downloadable` it neither resolved nor
 * rejected within 8 s, because Chrome was waiting for a download that the document cannot
 * start without a user gesture). Detection runs before the bubble mounts, so an unresolved
 * detector must not swallow the selection: the caller falls back to the document's language,
 * and the detector promise stays cached for the next selection.
 */
export async function detectLanguage(text: string, timeoutMs = 1000): Promise<string | null> {
  const api = getBuiltInLanguageDetectorApi()
  if (!api) {
    return null
  }

  const detected = (async () => {
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
  })()

  return Promise.race([
    detected,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
}