import { createRoot } from "react-dom/client"
import { getUiLocale, t } from "@/utils/i18n"
import { settingsItem, type NanoglossSettings } from "@/utils/storage"
import { isDarkTheme } from "@/utils/theme"
import { App } from "./App"
import "./style.css"

document.documentElement.lang = getUiLocale()
document.title = t("optionsPageTitle")

const container = document.getElementById("root")
if (!container) {
  throw new Error("Options page root element is missing")
}

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")

function updateTheme(theme: NanoglossSettings["theme"]) {
  document.documentElement.dataset.theme = isDarkTheme(theme) ? "dark" : "light"
}

// Initial theme from settings
void settingsItem.getValue().then((settings) => {
  updateTheme(settings.theme)
})

// React to setting changes immediately
settingsItem.watch((newSettings) => {
  updateTheme(newSettings.theme)
})

systemTheme.addEventListener("change", async () => {
  const current = await settingsItem.getValue()
  if (current.theme === "system") {
    updateTheme("system")
  }
})

createRoot(container).render(<App />)