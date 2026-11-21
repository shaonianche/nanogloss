import { createRoot } from "react-dom/client"
import { getUiLocale, t } from "@/utils/i18n"
import { followThemeSetting } from "@/utils/page-theme"
import { settingsItem } from "@/utils/storage"
import { WelcomePage } from "./welcome-page"
import "./style.css"

document.documentElement.lang = getUiLocale()
document.title = t("welcomePageTitle")

const container = document.getElementById("root")
if (!container) {
  throw new Error("Welcome page root element is missing")
}

followThemeSetting()

// Rendered once the settings are here, so the language selects never flip from the defaults.
void settingsItem.getValue().then((settings) => {
  createRoot(container).render(<WelcomePage initialSettings={settings} />)
})
