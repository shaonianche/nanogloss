import { beforeEach, describe, expect, it } from "vitest"
import type { SelectionSegment } from "@/utils/segments"
import { translatableText } from "@/utils/segments"
import { readSelection } from "./selection"

/**
 * jsdom has no layout, so a range has no box and `readSelection` would treat every selection as
 * invisible. Give it a box; the value itself never matters, only that it is not empty.
 */
const SELECTION_RECT = {
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  top: 0,
  left: 0,
  right: 100,
  bottom: 20,
  toJSON: () => ({}),
} as DOMRect

beforeEach(() => {
  document.body.innerHTML = ""
  Range.prototype.getBoundingClientRect = () => SELECTION_RECT
})

/** Selects an element's contents, the way a drag over that element would. */
function selectContents(selector: string): void {
  const element = document.querySelector(selector)
  if (element === null) {
    throw new Error(`fixture is missing ${selector}`)
  }

  const range = document.createRange()
  range.selectNodeContents(element)

  const selection = window.getSelection()
  if (selection === null) {
    throw new Error("this environment provides no selection")
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

function readFixture(html: string, selector: string, minCharacters = 1): SelectionSegment[] | null {
  document.body.innerHTML = html
  selectContents(selector)
  return readSelection(minCharacters)?.segments ?? null
}

describe("readSelection", () => {
  const cases: Array<{ name: string, html: string, selector?: string, expected: SelectionSegment[] }> = [
    {
      name: "keeps prose whole",
      html: "<p>The quick brown fox jumps over the lazy dog.</p>",
      expected: [{ kind: "text", text: "The quick brown fox jumps over the lazy dog." }],
    },
    {
      name: "keeps inline code inside its sentence",
      html: "<p>Run <code>pnpm build</code> to build the extension.</p>",
      expected: [{ kind: "text", text: "Run pnpm build to build the extension." }],
    },
    {
      name: "still translates inline code that is selected on its own",
      html: "<p>Run <code>pnpm build</code> to build.</p>",
      selector: "code",
      expected: [{ kind: "text", text: "pnpm build" }],
    },
    {
      name: "splits a selection that spans prose and a code block",
      html: "<div><p>Hello.</p><pre><code>const x = 1;</code></pre><p>Bye.</p></div>",
      selector: "div",
      expected: [
        { kind: "text", text: "Hello.\n" },
        { kind: "code", text: "const x = 1;" },
        { kind: "text", text: "\nBye." },
      ],
    },
    {
      // The separator before the leading code block is dropped; the one after it is kept, because
      // it is what separates the code from the prose that follows.
      name: "starts a selection with a code block",
      html: "<div><pre><code>const x = 1;</code></pre><p>Bye.</p></div>",
      selector: "div",
      expected: [
        { kind: "code", text: "const x = 1;" },
        { kind: "text", text: "\nBye." },
      ],
    },
    {
      // Hard-wrapped HTML source: the newline and indent inside the sentence render as one space.
      name: "reads source line breaks inside a paragraph as spaces",
      html: "<p>\n  The quick brown fox\n  jumps over <b>the\n  lazy</b> dog.\n</p>",
      expected: [{ kind: "text", text: "The quick brown fox jumps over the lazy dog." }],
    },
    {
      name: "keeps one line break between paragraphs whatever the source indentation",
      html: "<div>\n  <p>First\n  one.</p>\n\n  <p>Second one.</p>\n</div>",
      selector: "div",
      expected: [{ kind: "text", text: "First one.\nSecond one." }],
    },
    {
      name: "keeps the line breaks of pre-formatted prose",
      html: '<p style="white-space: pre-wrap">Roses are red\nViolets are blue</p>',
      expected: [{ kind: "text", text: "Roses are red\nViolets are blue" }],
    },
  ]

  for (const testCase of cases) {
    it(testCase.name, () => {
      const segments = readFixture(testCase.html, testCase.selector ?? "p")
      expect(segments).toEqual(testCase.expected)
    })
  }

  it("returns nothing for a code-only paragraph", () => {
    expect(readFixture('<p><code>const answer = await translate("Hi");</code></p>', "p")).toBeNull()
  })

  it("returns nothing for a block of several code spans", () => {
    expect(readFixture("<p><code>pnpm install</code> <code>pnpm test</code></p>", "p")).toBeNull()
  })

  it("returns nothing for a <pre> block", () => {
    expect(readFixture("<pre><code>const x = 1;</code></pre>", "pre")).toBeNull()
  })

  it("returns nothing for a code block with line breaks", () => {
    expect(readFixture("<p><code>first()</code><br><code>second()</code></p>", "p")).toBeNull()
  })

  it("returns nothing for a selection shorter than the minimum", () => {
    expect(readFixture("<p>Hi</p>", "p", 5)).toBeNull()
  })

  it("returns nothing for a whitespace-only selection", () => {
    expect(readFixture("<p>   </p>", "p", 2)).toBeNull()
  })

  it("returns nothing when the selection is code only regardless of minimum length", () => {
    expect(readFixture("<p><code>x</code></p>", "p", 1)).toBeNull()
  })

  it("ignores selections inside editable regions", () => {
    expect(readFixture('<div contenteditable="true">Hello there</div>', "div", 1)).toBeNull()
  })

  it("ignores selections inside plaintext-only editable regions", () => {
    expect(readFixture('<div contenteditable="plaintext-only">Hello there</div>', "div", 1)).toBeNull()
  })

  it("ignores a selection that ends inside an editable region", () => {
    document.body.innerHTML = '<p>Start here and</p><div contenteditable="true">end here</div>'
    const startText = document.querySelector("p")?.firstChild
    const endText = document.querySelector("div")?.firstChild
    if (!(startText instanceof Text) || !(endText instanceof Text)) {
      throw new Error("fixture is missing its text nodes")
    }

    const range = document.createRange()
    range.setStart(startText, 0)
    range.setEnd(endText, 3)

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error("this environment provides no selection")
    }
    selection.removeAllRanges()
    selection.addRange(range)

    expect(readSelection(1)).toBeNull()
  })

  it("translates nothing when the selection is code only", () => {
    expect(translatableText([{ kind: "code", text: "const x = 1;" }])).toBe("")
  })

  /**
   * A drag leaves the range rooted in a text node, not in an element, and that path never walks
   * past the code element that makes the text code — it has to read the DOM for itself.
   */
  it("ignores a selection that lives entirely inside a code text node", () => {
    document.body.innerHTML = "<p><code>const x = 1;</code></p>"
    const text = document.querySelector("code")?.firstChild
    if (!(text instanceof Text)) {
      throw new Error("fixture is missing its code text node")
    }

    const range = document.createRange()
    range.setStart(text, 6)
    range.setEnd(text, 11)

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error("this environment provides no selection")
    }
    selection.removeAllRanges()
    selection.addRange(range)

    expect(readSelection(1)).toBeNull()
  })
})

describe("translatableText", () => {
  it("joins the text segments and drops the block separators at either end", () => {
    expect(translatableText([
      { kind: "text", text: "\nHello.\n" },
      { kind: "code", text: "const x = 1;" },
      { kind: "text", text: "\nBye.\n" },
    ])).toBe("Hello.\n\nBye.")
  })

  it("is empty for code only", () => {
    expect(translatableText([{ kind: "code", text: "const x = 1;" }])).toBe("")
  })
})