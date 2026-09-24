import { isSameLanguage, resolveLanguageCode, type SupportedLanguageCode } from "./languages"
import { translatableText, type SelectionSegment } from "./segments"
import { detectLanguage, getBuiltInTranslatorApi, getTranslator, toTranslatorFailure, type TranslatorFailureReason } from "./translator"

export type TranslationState =
  /** Nothing requested yet: the controller's neutral state, before the first selection. */
  | { status: "idle" }
  | { status: "checking" }
  /** The language pack is being fetched (or already was): `percent` is 0…100. */
  | { status: "downloading", percent: number }
  | { status: "translating" }
  | { status: "done", translation: string }
  | { status: "error", reason: TranslatorFailureReason, message: string }
  /** The selection is code and nothing else: there is no prose to translate. */
  | { status: "code-only" }
  /**
   * The selection is already in a language the user reads (see `isSameLanguage`): nothing to
   * translate. The two states above describe the selection rather than a request, which is why
   * `select()` sets them instead of `run()` — and why the content script does not mount the
   * bubble for either. Surfaces that render in place (the playground) show them as notes.
   */
  | { status: "same-language" }

export interface BubbleSnapshot {
  /** The selection in order, so the bubble can render code blocks as code. */
  segments: SelectionSegment[]
  /** The translatable part of the selection, derived from `segments` when it is selected. */
  text: string
  sourceLanguage: SupportedLanguageCode | null
  targetLanguage: SupportedLanguageCode
  state: TranslationState
}

export interface SelectionTranslationController {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => BubbleSnapshot
  /**
   * Gate and arm a new selection: resolves an `auto` source language up front, then answers
   * whether the selection is worth showing. `false` means either a same-language selection
   * (the state says `same-language`) or that a newer selection superseded this one while the
   * detector was running. On `true` the translation is already in flight.
   */
  select: (selection: {
    segments: SelectionSegment[]
    /** `null` asks the built-in language detector. */
    sourceLanguage: SupportedLanguageCode | null
    /** What the page declares, used when the detector cannot place the selection. */
    documentLanguage: SupportedLanguageCode | null
    targetLanguage: SupportedLanguageCode
  }) => Promise<boolean>
  /** Start (or restart) the translation for the current selection. */
  translate: () => void
  /** Hide the bubble and drop any in-flight result. */
  cancel: () => void
}

const TRANSLATION_CACHE_LIMIT = 200
const translationCache = new Map<string, string>()

function cacheKey(text: string, sourceLanguage: string, targetLanguage: string) {
  return `${sourceLanguage}->${targetLanguage}\n${text}`
}

function cacheGet(key: string) {
  const cached = translationCache.get(key)
  if (cached !== undefined) {
    // Refresh recency so re-selecting the same text stays cheap.
    translationCache.delete(key)
    translationCache.set(key, cached)
  }
  return cached
}

function cacheSet(key: string, translation: string) {
  translationCache.set(key, translation)
  while (translationCache.size > TRANSLATION_CACHE_LIMIT) {
    const oldest = translationCache.keys().next().value
    if (oldest === undefined) {
      break
    }
    translationCache.delete(oldest)
  }
}

export const UNKNOWN_SOURCE_MESSAGE = "Could not tell which language this is. Pick a source language in the settings."

export function createSelectionTranslationController(): SelectionTranslationController {
  let snapshot: BubbleSnapshot = {
    segments: [],
    text: "",
    sourceLanguage: null,
    targetLanguage: "en",
    state: { status: "idle" },
  }
  const listeners = new Set<() => void>()
  let requestId = 0

  function set(next: Partial<BubbleSnapshot>) {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) {
      listener()
    }
  }

  function fail(reason: TranslatorFailureReason, message: string) {
    set({ state: { status: "error", reason, message } })
  }

  async function run() {
    const id = ++requestId
    const isStale = () => requestId !== id
    const { text, sourceLanguage, targetLanguage } = snapshot

    if (!text) {
      return
    }

    // select() resolves `auto` before arming, so a missing source here means neither the
    // detector nor the page could place the selection.
    if (!sourceLanguage) {
      fail("unsupported-pair", UNKNOWN_SOURCE_MESSAGE)
      return
    }

    const api = getBuiltInTranslatorApi()
    if (!api) {
      fail("unsupported-pair", "This browser does not support Chrome's built-in translator.")
      return
    }

    const key = cacheKey(text, sourceLanguage, targetLanguage)
    const cached = cacheGet(key)
    if (cached !== undefined) {
      set({ state: { status: "done", translation: cached } })
      return
    }

    try {
      set({ state: { status: "checking" } })
      const availability = await api.availability({ sourceLanguage, targetLanguage })
      if (isStale()) {
        return
      }

      if (availability === "unavailable") {
        fail("unsupported-pair", `Chrome cannot translate ${sourceLanguage} → ${targetLanguage} on this device.`)
        return
      }

      const needsDownload = availability === "downloadable" || availability === "downloading"
      set({ state: needsDownload ? { status: "downloading", percent: 0 } : { status: "translating" } })

      // The Chrome docs ask for a user activation before `create()`, and for good reason: a
      // document without one cannot start a language-pack download, and a `create()` that has
      // to wait for a download it cannot start stays pending instead of rejecting (verified
      // with the detector, which hangs the same way). Ask for the click up front, so the bubble
      // offers its "Download language pack" button instead of waiting on nothing.
      const hasUserActivation = navigator.userActivation?.isActive ?? true
      if (needsDownload && !hasUserActivation) {
        fail("needs-user-gesture", "Chrome needs a click before it can download the language pack. Use the button below.")
        return
      }

      const translator = await getTranslator({
        sourceLanguage,
        targetLanguage,
        onDownloadProgress: (percent) => {
          if (!isStale()) {
            set({ state: { status: "downloading", percent } })
          }
        },
      })
      if (isStale()) {
        return
      }

      set({ state: { status: "translating" } })
      const translation = await translator.translate(text)
      if (isStale()) {
        return
      }

      cacheSet(key, translation)
      set({ state: { status: "done", translation } })
    }
    catch (error) {
      if (isStale()) {
        return
      }
      const failure = toTranslatorFailure(error)
      fail(failure.reason, failure.message)
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    async select({ segments, sourceLanguage: configured, documentLanguage, targetLanguage }) {
      const id = ++requestId
      const text = translatableText(segments)

      set({
        segments,
        text,
        sourceLanguage: configured,
        targetLanguage,
        // Code is never translated, so a selection made of code has nothing to ask for: the
        // bubble renders the code block and says why there is no translation.
        state: text ? { status: "checking" } : { status: "code-only" },
      })

      // `null` means "unknown": ask the built-in language detector, which reads the selection
      // rather than the page — a page that declares English can still quote German. The page's
      // own language is only the fallback, for selections the detector cannot place at all.
      let sourceLanguage = configured
      if (!sourceLanguage && text) {
        sourceLanguage = resolveLanguageCode(await detectLanguage(text)) ?? documentLanguage
        if (requestId !== id) {
          return false
        }
        set({ sourceLanguage })
      }

      // Already in a language the user reads: there is nothing to translate.
      if (sourceLanguage && isSameLanguage(sourceLanguage, targetLanguage)) {
        set({ state: { status: "same-language" } })
        return false
      }

      if (text) {
        void run()
      }
      return true
    },
    translate() {
      void run()
    },
    cancel() {
      requestId++
      set({ segments: [], text: "", state: { status: "idle" } })
    },
  }
}
