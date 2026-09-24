import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
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