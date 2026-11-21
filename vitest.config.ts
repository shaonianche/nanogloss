import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import { WxtVitest } from "wxt/testing/vitest-plugin"

export default defineConfig({
  // Resolves `#imports` and backs `browser.storage` with WXT's in-memory fake browser.
  plugins: [WxtVitest()],
  resolve: {
    // Same alias as the tsconfig paths, so sources under test can import "@/...".
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // `readSelection` reads `window.getSelection()` and the document, so the tests need a DOM.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
})
