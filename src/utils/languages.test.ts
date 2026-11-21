import { describe, expect, it } from "vitest"
import { resolveLanguageCode } from "./languages"

describe("resolveLanguageCode", () => {
  it("resolves region tags to their primary language", () => {
    expect(resolveLanguageCode("en-US")).toBe("en")
    expect(resolveLanguageCode("pt-BR")).toBe("pt")
    expect(resolveLanguageCode("de-DE")).toBe("de")
  })

  it("keeps Traditional Chinese apart from Simplified", () => {
    expect(resolveLanguageCode("zh-TW")).toBe("zh-Hant")
    expect(resolveLanguageCode("zh-tw")).toBe("zh-Hant")
    expect(resolveLanguageCode("zh-Hant-TW")).toBe("zh-Hant")
    expect(resolveLanguageCode("zh-Hans-CN")).toBe("zh")
    expect(resolveLanguageCode("zh-Hans-TW")).toBe("zh")
    expect(resolveLanguageCode("zh-cn")).toBe("zh")
  })

  it("rejects languages the translator does not support", () => {
    expect(resolveLanguageCode("xx-YY")).toBeNull()
    expect(resolveLanguageCode("")).toBeNull()
  })
})
