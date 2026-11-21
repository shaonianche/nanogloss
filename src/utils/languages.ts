/**
 * Languages supported by Chrome's built-in Translator API.
 *
 * Desktop Chrome 138+ only, and the list is Chrome-specific: it can change between
 * versions. Unsupported pairs make `Translator.availability()` resolve to
 * `"unavailable"`, so always check before translating.
 *
 * @see https://developer.chrome.com/docs/ai/translator-api
 */
export const SUPPORTED_LANGUAGE_CODES = [
  "ar",
  "bg",
  "bn",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "kn",
  "ko",
  "lt",
  "mr",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
  "zh-Hant",
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number]

export const LANGUAGE_LABELS: Record<SupportedLanguageCode, string> = {
  ar: "Arabic",
  bg: "Bulgarian",
  bn: "Bengali",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  kn: "Kannada",
  ko: "Korean",
  lt: "Lithuanian",
  mr: "Marathi",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sv: "Swedish",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
}

/**
 * Codes that resolve to a supported language but are not in the list above.
 *
 * Verified against Chrome 154: the API accepts `cmn` (ISO 639-3 for Mandarin) and
 * resolves it to `zh`. Useful when reusing language codes from other projects.
 */
export const LANGUAGE_ALIASES: Record<string, SupportedLanguageCode> = {
  cmn: "zh",
  "zh-CN": "zh",
  "zh-Hans": "zh",
  "zh-SG": "zh",
  "zh-TW": "zh-Hant",
  "zh-HK": "zh-Hant",
  "zh-MO": "zh-Hant",
}

/** Normalise an arbitrary language code to a code the built-in translator accepts. */
export function resolveLanguageCode(input: string | null | undefined): SupportedLanguageCode | null {
  if (!input) {
    return null
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  if ((SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(trimmed)) {
    return trimmed as SupportedLanguageCode
  }

  const [primary = ""] = trimmed.split("-")
  const alias = LANGUAGE_ALIASES[trimmed] ?? LANGUAGE_ALIASES[primary]
  if (alias) {
    return alias
  }

  // Tags the table does not list, such as `zh-tw` or `zh-Hant-TW`, still name a script by their
  // subtags; falling back to `zh` alone would read Traditional Chinese as Simplified.
  const subtags = trimmed.toLowerCase().split("-")
  const [language = ""] = subtags
  if (language === "zh") {
    const traditional = !subtags.includes("hans") && subtags.some(subtag => ["hant", "tw", "hk", "mo"].includes(subtag))
    return traditional ? "zh-Hant" : "zh"
  }

  // Region tags such as `en-US` or `pt-BR` name a language the translator knows by its primary subtag.
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(language) ? language as SupportedLanguageCode : null
}

/**
 * Whether two codes name the same language for translation purposes.
 *
 * Chinese matches by prefix: a selection in `zh` made by someone whose target is `zh-Hant`
 * (or the other way around) is already in a language they read, so translating it would be
 * noise. Shared by the content script, the controller and the playground so all three skip
 * — or translate — the same pairs.
 */
export function isSameLanguage(source: string, target: string): boolean {
  if (source === target) {
    return true
  }
  return source.startsWith("zh") && target.startsWith("zh")
}

/** Language of the current document, when the page declares one. */
export function getDocumentLanguage(): SupportedLanguageCode | null {
  if (typeof document === "undefined") {
    return null
  }

  return resolveLanguageCode(document.documentElement.lang)
    ?? resolveLanguageCode(document.querySelector("meta[http-equiv='content-language']")?.getAttribute("content"))
}