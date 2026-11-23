import { describe, expect, it } from "vitest"
import { BUBBLE_CODE_MIN_WIDTH, BUBBLE_MAX_WIDTH, BUBBLE_MIN_WIDTH, bubbleWidthFor } from "./selection-bubble"

describe("bubbleWidthFor", () => {
  it("uses the minimum width for very short selections", () => {
    expect(bubbleWidthFor([{ kind: "text", text: "Hello" }])).toBe(BUBBLE_MIN_WIDTH)
    expect(bubbleWidthFor([{ kind: "text", text: "翻译测试" }])).toBe(BUBBLE_MIN_WIDTH)
  })

  it("uses the maximum width for long selections", () => {
    const longLatin = "A".repeat(220)
    const longCjk = "测".repeat(110)
    expect(bubbleWidthFor([{ kind: "text", text: longLatin }])).toBe(BUBBLE_MAX_WIDTH)
    expect(bubbleWidthFor([{ kind: "text", text: longCjk }])).toBe(BUBBLE_MAX_WIDTH)
  })

  it("scales smoothly between minimum and maximum for medium selections", () => {
    const shortPhrase = bubbleWidthFor([{ kind: "text", text: "Machine translation has improved." }])
    const longerSentence = bubbleWidthFor([{ kind: "text", text: "Machine translation has improved dramatically over the last decade, especially for technical writing." }])

    expect(shortPhrase).toBeGreaterThan(BUBBLE_MIN_WIDTH)
    expect(shortPhrase).toBeLessThan(longerSentence)
    expect(longerSentence).toBeLessThan(BUBBLE_MAX_WIDTH)
  })

  it("weights CJK characters as twice Latin characters", () => {
    const latin = bubbleWidthFor([{ kind: "text", text: "a".repeat(80) }])
    const cjk = bubbleWidthFor([{ kind: "text", text: "中".repeat(40) }])
    expect(cjk).toBe(latin)
  })

  it("applies the code floor when a selection includes a code block", () => {
    expect(bubbleWidthFor([
      { kind: "text", text: "Run" },
      { kind: "code", text: "pnpm test" },
    ])).toBe(BUBBLE_CODE_MIN_WIDTH)
  })
})
