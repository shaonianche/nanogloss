import { storage } from "#imports"

export interface NanoglossSettings {
  /** BCP-47 code, or `auto` to let the page/selection decide. */
  sourceLanguage: string
  /** BCP-47 code supported by Chrome's built-in translator. */
  targetLanguage: string
  /**
   * `auto` translates every selection, `alt` only selections made while Alt was held, and
   * `long-press` translates when holding the left mouse button down for a duration.
   */
  trigger: "auto" | "alt" | "long-press"
  /** Duration in milliseconds to hold the mouse button before triggering in long-press mode. */
  longPressDelay: number
  /** Selections shorter than this are ignored (avoids single-letter noise). */
  minCharacters: number
  /** Color theme preference: system, light, or dark. */
  theme: "system" | "light" | "dark"
}

export const DEFAULT_SETTINGS: NanoglossSettings = {
  sourceLanguage: "auto",
  targetLanguage: "zh",
  trigger: "auto",
  longPressDelay: 1000,
  minCharacters: 2,
  theme: "system",
}

export const settingsItem = storage.defineItem<NanoglossSettings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
})