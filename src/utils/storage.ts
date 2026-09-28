import { storage } from "#imports"

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

export const DEFAULT_SETTINGS: NanoglossSettings = {
  sourceLanguage: "auto",
  targetLanguage: "zh",
  triggerMode: "manual",
  triggerAlt: true,
  triggerLongPress: true,
  longPressDelay: 1000,
  minCharacters: 2,
  theme: "system",
}

export const settingsItem = storage.defineItem<NanoglossSettings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
})