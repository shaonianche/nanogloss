import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { getBrowserLanguages, type SupportedLanguageCode } from "@/utils/languages"
import { getBuiltInTranslatorApi, getTranslator } from "@/utils/translator"

const STORAGE_KEY_PREFIX = "nanogloss_i18n_v2_"

/**
 * The options page translates its own UI with the built-in translator — the page is itself
 * a demo of the engine. There is deliberately no hand-maintained locale table: every phrase
 * goes through en → browser-language translation, then persists to localStorage so the next
 * visit renders translated immediately. When the engine or the language pack is missing,
 * the page simply stays in English.
 */

/** How long to wait for more phrases before flushing the translation queue. */
const FLUSH_DEBOUNCE_MS = 40
/** How long to wait before re-checking a language pack that is still downloading. */
const RETRY_DELAY_MS = 4000

function loadCache(lang: SupportedLanguageCode): Record<string, string> {
  if (typeof localStorage === "undefined") {
    return {}
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${lang}`)
    return raw ? JSON.parse(raw) as Record<string, string> : {}
  }
  catch {
    return {}
  }
}

function saveCache(lang: SupportedLanguageCode, cache: Record<string, string>) {
  if (typeof localStorage === "undefined") {
    return
  }
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${lang}`, JSON.stringify(cache))
  }
  catch {}
}

export function getUserLanguage(): SupportedLanguageCode {
  return getBrowserLanguages()[0] ?? "en"
}

interface I18nContextValue {
  t: (text: string) => string
  targetLanguage: SupportedLanguageCode
  isEnglish: boolean
}

const I18nContext = createContext<I18nContextValue>({
  t: (text: string) => text,
  targetLanguage: "en",
  isEnglish: true,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [targetLanguage] = useState<SupportedLanguageCode>(() => getUserLanguage())
  const isEnglish = targetLanguage === "en"

  const [cache, setCache] = useState<Record<string, string>>(() => loadCache(targetLanguage))

  const pendingSetRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTranslatingRef = useRef(false)
  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const flushQueueRef = useRef<() => Promise<void>>(async () => {})

  /** Debounces (or delays) the next flush, replacing any timer that is still pending. */
  function scheduleFlush(delayMs: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      void flushQueueRef.current()
    }, delayMs)
  }

  const flushQueue = useCallback(async () => {
    if (isEnglish || isTranslatingRef.current || pendingSetRef.current.size === 0) {
      return
    }

    const api = getBuiltInTranslatorApi()
    if (!api) {
      return
    }

    try {
      const availability = await api.availability({ sourceLanguage: "en", targetLanguage })
      if (availability === "downloadable" || availability === "downloading") {
        // The pack is not on disk yet: keep the strings queued and retry, because nothing
        // else would retrigger a flush once this batch's timer has fired.
        scheduleFlush(RETRY_DELAY_MS)
        return
      }
      if (availability !== "available") {
        return
      }

      isTranslatingRef.current = true

      const toTranslate = Array.from(pendingSetRef.current)
      pendingSetRef.current.clear()

      const translator = await getTranslator({ sourceLanguage: "en", targetLanguage })
      const newEntries: Record<string, string> = {}

      for (const text of toTranslate) {
        try {
          const translated = await translator.translate(text)
          if (translated && translated.trim()) {
            newEntries[text] = translated
          }
        }
        catch {
          // If a phrase fails, leave it in English fallback
        }
      }

      if (Object.keys(newEntries).length > 0) {
        setCache(prev => {
          const merged = { ...prev, ...newEntries }
          saveCache(targetLanguage, merged)
          return merged
        })
      }
    }
    finally {
      isTranslatingRef.current = false
      // Strings queued while this flush was running still need their own pass.
      if (pendingSetRef.current.size > 0) {
        scheduleFlush(FLUSH_DEBOUNCE_MS)
      }
    }
  }, [isEnglish, targetLanguage])

  flushQueueRef.current = flushQueue

  const t = useCallback((text: string): string => {
    if (!text || text.trim() === "" || isEnglish) {
      return text
    }

    const cached = cacheRef.current[text]
    if (cached) {
      return cached
    }

    if (!pendingSetRef.current.has(text)) {
      pendingSetRef.current.add(text)
      scheduleFlush(FLUSH_DEBOUNCE_MS)
    }

    return text
  }, [isEnglish, targetLanguage])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <I18nContext.Provider value={{ t, targetLanguage, isEnglish }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
