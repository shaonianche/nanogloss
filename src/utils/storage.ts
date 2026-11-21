import { storage } from "#imports"
import { getUiLocale } from "./i18n"
import { resolveLanguageCode, type SupportedLanguageCode } from "./languages"

export interface NanoglossSettings {
  /** BCP-47 code, or `auto` to let the page/selection decide. */
  sourceLanguage: string
  /** BCP-47 code supported by Chrome's built-in translator. */
  targetLanguage: string
  /**
   * Primary trigger mode:
   * - `auto`: translates immediately after selecting text.
   * - `manual`: triggers on configured shortcut gestures (Alt + selection, long-press, or both).
   */
  triggerMode: "auto" | "manual"
  /** Whether holding Alt while selecting triggers translation in manual mode. */
  triggerAlt: boolean
  /** Whether holding the left mouse button after selection triggers translation in manual mode. */
  triggerLongPress: boolean
  /** Duration in milliseconds to hold the mouse button before triggering in long-press mode. */
  longPressDelay: number
  /** Selections shorter than this are ignored (avoids single-letter noise). */
  minCharacters: number
  /** Color theme preference: system, light, or dark. */
  theme: "system" | "light" | "dark"
}

/**
 * Picks the initial target language from Chrome's UI locale so new installs default to the
 * browser's own language (falling back to English when that locale isn't supported by the
 * Translator API).
 */
export function resolveDefaultTargetLanguage(locale: string = getUiLocale()): SupportedLanguageCode {
  return resolveLanguageCode(locale) ?? "en"
}

export const DEFAULT_SETTINGS: NanoglossSettings = {
  sourceLanguage: "auto",
  targetLanguage: resolveDefaultTargetLanguage(),
  triggerMode: "manual",
  triggerAlt: true,
  triggerLongPress: true,
  longPressDelay: 1000,
  minCharacters: 2,
  theme: "system",
}

/** Version 1 stored a single `trigger` instead of the mode and gesture fields. */
type SettingsV1 = Partial<NanoglossSettings> & { trigger?: "auto" | "alt" | "long-press" }

/**
 * Converts version-1 settings to the current shape.
 *
 * Version 1 covers two shapes: the single `trigger` field, and the current fields written before
 * the item had a version. Both are merged over the defaults, so a field the old shape lacked reads
 * as its default instead of `undefined` — a missing `triggerMode` would otherwise make the content
 * script treat the user as `auto`.
 */
function migrateSettingsToV2(old: SettingsV1): NanoglossSettings {
  const { trigger, ...rest } = old
  const settings = { ...DEFAULT_SETTINGS, ...rest }
  switch (trigger) {
    case "auto":
      return { ...settings, triggerMode: "auto" }
    case "alt":
      return { ...settings, triggerMode: "manual", triggerAlt: true, triggerLongPress: false }
    case "long-press":
      return { ...settings, triggerMode: "manual", triggerAlt: false, triggerLongPress: true }
    default:
      return settings
  }
}

export const settingsItem = storage.defineItem<NanoglossSettings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    2: migrateSettingsToV2,
  },
})
