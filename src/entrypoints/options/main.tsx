import { createRoot } from "react-dom/client"
import { getUiLocale, t } from "@/utils/i18n"
import { followThemeSetting } from "@/utils/page-theme"
import { App } from "./App"
import "./style.css"

document.documentElement.lang = getUiLocale()
document.title = t("optionsPageTitle")

const container = document.getElementById("root")
if (!container) {
  throw new Error("Options page root element is missing")
}

followThemeSetting()

createRoot(container).render(<App />)