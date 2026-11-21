import { describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import enMessages from "../../public/_locales/en/messages.json"
import jaMessages from "../../public/_locales/ja/messages.json"
import zhCnMessages from "../../public/_locales/zh_CN/messages.json"
import zhTwMessages from "../../public/_locales/zh_TW/messages.json"
import { getUiLocale, t, type MessageKey } from "./i18n"
import { getLanguageLabel } from "./languages"

const LOCALE_CATALOGS = {
  en: enMessages,
  ja: jaMessages,
  zh_CN: zhCnMessages,
  zh_TW: zhTwMessages,
} as const

describe("_locales message catalogs", () => {
  const baseKeys = Object.keys(enMessages).sort()

  for (const [locale, catalog] of Object.entries(LOCALE_CATALOGS)) {
    it(`${locale} defines the exact same keys as en with non-empty messages`, () => {
      expect(Object.keys(catalog).sort()).toEqual(baseKeys)
      for (const [key, entry] of Object.entries(catalog)) {
        expect(entry.message.trim(), `${locale}.${key} should not be empty`).not.toBe("")
      }
    })

    it(`${locale} keeps the same placeholder names as en`, () => {
      for (const key of baseKeys) {
        const enEntry = enMessages[key as MessageKey]
        const locEntry = catalog[key as MessageKey]
        const enPlaceholders = "placeholders" in enEntry ? Object.keys(enEntry.placeholders).sort() : []
        const locPlaceholders = "placeholders" in locEntry ? Object.keys(locEntry.placeholders).sort() : []
        expect(locPlaceholders, `${locale}.${key} placeholders`).toEqual(enPlaceholders)

        for (const placeholder of locPlaceholders) {
          expect(locEntry.message, `${locale}.${key} should reference $${placeholder.toUpperCase()}$`)
            .toContain(`$${placeholder.toUpperCase()}$`)
        }
      }
    })

    it(`${locale} extensionDescription stays within the Chrome Web Store 132-character limit`, () => {
      expect(catalog.extensionDescription.message.length).toBeLessThanOrEqual(132)
    })
  }
})

describe("i18n helpers", () => {
  it("formats fallback messages with named placeholders when browser.i18n is unavailable", () => {
    expect(t("engineUnavailableBannerDescription", "138")).toContain("Chrome 138")
    expect(t("errorUnsupportedPair", ["English", "Japanese"])).toBe(
      "Chrome can't translate from English to Japanese on this device.",
    )
  })

  it("uses browser.i18n.getMessage when available", () => {
    const spy = vi.spyOn(fakeBrowser.i18n, "getMessage").mockReturnValue("翻译引擎可用")
    try {
      expect(t("engineAvailable")).toBe("翻译引擎可用")
      expect(spy).toHaveBeenCalledWith("engineAvailable", undefined)
    }
    finally {
      spy.mockRestore()
    }
  })

  it("normalizes underscores in browser.i18n.getUILanguage to BCP-47 tags", () => {
    const spy = vi.spyOn(fakeBrowser.i18n, "getUILanguage").mockReturnValue("zh_CN")
    try {
      expect(getUiLocale()).toBe("zh-CN")
    }
    finally {
      spy.mockRestore()
    }
  })
})

describe("getLanguageLabel", () => {
  it("formats Chinese and Japanese labels cleanly across supported locales", () => {
    expect(getLanguageLabel("zh", "en")).toBe("Simplified Chinese")
    expect(getLanguageLabel("zh-Hant", "en")).toBe("Traditional Chinese")
    expect(getLanguageLabel("zh", "zh-CN")).toBe("简体中文")
    expect(getLanguageLabel("zh-Hant", "zh-CN")).toBe("繁体中文")
    expect(getLanguageLabel("zh", "zh-TW")).toBe("簡體中文")
    expect(getLanguageLabel("zh-Hant", "zh-TW")).toBe("繁體中文")
    expect(getLanguageLabel("ja", "ja")).toBe("日本語")
    expect(getLanguageLabel("zh", "ja")).toBe("簡体中国語")
    expect(getLanguageLabel("zh-Hant", "ja")).toBe("繁体中国語")
  })
})
