import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  // Keep imports explicit (`import { browser } from "#imports"`) instead of relying on
  // WXT's auto-imports, so every symbol in a file is visible at the top of the file.
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    default_locale: "en",
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    // The Translator API ships in Chrome 138; an older Chrome would install the extension and
    // then do nothing. Keep in step with `MINIMUM_CHROMIUM_VERSION` in `src/utils/browser-support.ts`.
    minimum_chrome_version: "138",
    // The Translator API is a Web API, so it needs no permission. `storage` is for settings.
    permissions: ["storage"],
    // No popup: the toolbar button opens the settings page (see `background.ts`).
    action: {
      default_title: "__MSG_extensionName__",
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
  zip: {
    excludeSources: ["docs/**/*"],
  },
  dev: {
    server: {
      port: 3334,
      strictPort: false,
    },
  },
})