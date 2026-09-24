import type { NanoglossSettings } from "./storage"

/**
 * Resolves the theme setting against the system preference.
 *
 * Shared by the options page and the in-page bubble so that an explicit "light" or "dark"
 * choice means the same thing on both surfaces; `system` asks the OS.
 */
export function isDarkTheme(theme: NanoglossSettings["theme"]): boolean {
  return theme === "dark"
    || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
}
