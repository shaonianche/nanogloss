import { describe, expect, it } from "vitest"
import { translationChunks } from "./segments"

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