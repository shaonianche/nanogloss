import { settingsItem, type NanoglossSettings } from "./storage"
import { isDarkTheme } from "./theme"

function apply(theme: NanoglossSettings["theme"]) {
  document.documentElement.dataset.theme = isDarkTheme(theme) ? "dark" : "light"
}

/**
 * Keeps an extension page on the theme setting: now, when the setting changes, and when the
 * system appearance changes while the setting follows it. HeroUI switches themes through
 * `data-theme` on the root element.
 */
export function followThemeSetting() {
  void settingsItem.getValue().then(settings => apply(settings.theme))
  settingsItem.watch(settings => apply(settings.theme))
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
    const { theme } = await settingsItem.getValue()
    if (theme === "system") {
      apply(theme)
    }
  })
}
