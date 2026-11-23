import { describe, expect, it } from "vitest"
import {
  extractInlineLiterals,
  prepareTranslationInput,
  restorePartialRuns,
  restoreTranslationRuns,
  translationChunks,
} from "./segments"

describe("translationChunks", () => {
  it("asks for nothing when there is no text", () => {
    expect(translationChunks("   \n\t ")).toEqual([])
  })

  it("keeps a short selection in one request", () => {
    expect(translationChunks("The quick brown fox.")).toEqual(["The quick brown fox."])
  })

  it("splits a long selection on its paragraph breaks", () => {
    const paragraph = "x".repeat(400)
    expect(translationChunks(`${paragraph}\n\n${paragraph}`)).toEqual([paragraph, paragraph])
  })

  it("packs short paragraphs together up to the target", () => {
    expect(translationChunks("One.\n\nTwo.\n\nThree.", 10)).toEqual(["One.\n\nTwo.", "Three."])
  })

  it("leaves a paragraph longer than the target whole", () => {
    const paragraph = "y".repeat(1200)
    expect(translationChunks(paragraph)).toEqual([paragraph])
  })
})

describe("inline placeholder protection", () => {
  it("extracts URLs (without trailing punctuation) and template variables from prose", () => {
    const segments = extractInlineLiterals([
      { kind: "text", text: "See https://example.com/docs?a=1. Hello {{name}}, ${USER}, __MSG_app__, {0}, %s!" },
    ])
    expect(segments).toEqual([
      { kind: "text", text: "See " },
      { kind: "inline-literal", text: "https://example.com/docs?a=1" },
      { kind: "text", text: ". Hello " },
      { kind: "inline-literal", text: "{{name}}" },
      { kind: "text", text: ", " },
      { kind: "inline-literal", text: "${USER}" },
      { kind: "text", text: ", " },
      { kind: "inline-literal", text: "__MSG_app__" },
      { kind: "text", text: ", " },
      { kind: "inline-literal", text: "{0}" },
      { kind: "text", text: ", " },
      { kind: "inline-literal", text: "%s" },
      { kind: "text", text: "!" },
    ])
  })

  it("masks inline code and literals and restores them in reordered translations", () => {
    const prepared = prepareTranslationInput([
      { kind: "text", text: "Run " },
      { kind: "inline-code", text: "pnpm build" },
      { kind: "text", text: " and open https://example.com." },
    ])

    expect(prepared.maskedText).toBe("Run ⟦0⟧ and open ⟦1⟧.")
    expect(prepared.plainText).toBe("Run pnpm build and open https://example.com.")

    // Reordered placeholders (common in EN -> JA/ZH) still restore accurately.
    const runs = restoreTranslationRuns("打开 ⟦ 1 ⟧ 并运行 ⟦0⟧。", prepared.placeholders)
    expect(runs).toEqual([
      { kind: "text", text: "打开 " },
      { kind: "inline-literal", text: "https://example.com" },
      { kind: "text", text: " 并运行 " },
      { kind: "inline-code", text: "pnpm build" },
      { kind: "text", text: "。" },
    ])
  })

  it("returns null when a placeholder is missing, duplicated, or corrupted", () => {
    const prepared = prepareTranslationInput([
      { kind: "text", text: "Use " },
      { kind: "inline-code", text: "git status" },
    ])

    expect(restoreTranslationRuns("使用", prepared.placeholders)).toBeNull()
    expect(restoreTranslationRuns("使用 ⟦0⟧ 和 ⟦0⟧", prepared.placeholders)).toBeNull()
    expect(restoreTranslationRuns("使用 ⟦0⟧ ⟦", prepared.placeholders)).toBeNull()
  })

  it("hides incomplete trailing placeholder tokens while streaming", () => {
    const prepared = prepareTranslationInput([
      { kind: "text", text: "Run " },
      { kind: "inline-code", text: "pnpm test" },
    ])

    expect(restorePartialRuns("运行 ⟦0", prepared.placeholders)).toEqual([
      { kind: "text", text: "运行 " },
    ])
    expect(restorePartialRuns("运行 ⟦0⟧ 完成", prepared.placeholders)).toEqual([
      { kind: "text", text: "运行 " },
      { kind: "inline-code", text: "pnpm test" },
      { kind: "text", text: " 完成" },
    ])
  })
})