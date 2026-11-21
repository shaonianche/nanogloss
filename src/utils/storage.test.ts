import { describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { DEFAULT_SETTINGS, resolveDefaultTargetLanguage, settingsItem } from "./storage"

/** Stores `value` as unversioned (version 1) settings and runs the item's migrations over it. */
async function migrateFrom(value: object) {
  fakeBrowser.reset()
  await fakeBrowser.storage.local.set({ settings: value })
  await settingsItem.migrate()
  return settingsItem.getValue()
}

describe("settings migration", () => {
  const v1 = { sourceLanguage: "en", targetLanguage: "ja", longPressDelay: 1500, minCharacters: 4, theme: "dark" }

  it("maps the old single trigger to the mode and gesture fields", async () => {
    expect(await migrateFrom({ ...v1, trigger: "auto" })).toEqual({
      ...v1,
      triggerMode: "auto",
      triggerAlt: true,
      triggerLongPress: true,
    })
    expect(await migrateFrom({ ...v1, trigger: "alt" })).toEqual({
      ...v1,
      triggerMode: "manual",
      triggerAlt: true,
      triggerLongPress: false,
    })
    expect(await migrateFrom({ ...v1, trigger: "long-press" })).toEqual({
      ...v1,
      triggerMode: "manual",
      triggerAlt: false,
      triggerLongPress: true,
    })
  })

  it("keeps settings already in the current shape", async () => {
    const current = { ...v1, triggerMode: "auto", triggerAlt: false, triggerLongPress: true }
    expect(await migrateFrom(current)).toEqual(current)
  })

  it("fills fields the stored value lacks with their defaults", async () => {
    expect(await migrateFrom({ targetLanguage: "ja" })).toEqual({ ...DEFAULT_SETTINGS, targetLanguage: "ja" })
  })
})

describe("resolveDefaultTargetLanguage", () => {
  it("maps Chrome UI locales to supported translator language codes", () => {
    expect(resolveDefaultTargetLanguage("en-US")).toBe("en")
    expect(resolveDefaultTargetLanguage("zh-CN")).toBe("zh")
    expect(resolveDefaultTargetLanguage("zh-TW")).toBe("zh-Hant")
    expect(resolveDefaultTargetLanguage("ja")).toBe("ja")
  })

  it("falls back to English when the UI locale is unsupported", () => {
    expect(resolveDefaultTargetLanguage("xx-YY")).toBe("en")
    expect(resolveDefaultTargetLanguage("")).toBe("en")
  })
})
