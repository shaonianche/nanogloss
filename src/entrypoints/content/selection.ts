/**
 * Reads the current selection and splits it into what may be translated and what may not.
 *
 * Code is the one thing a translator must not touch: a snippet comes back mangled, and the
 * identifiers inside it are exactly what a reader needs to keep verbatim. Text inside a
 * block-level code element is therefore left out of the translation and rendered as a code
 * block instead (see `SelectionBubble`).
 */

import { translatableText, type SelectionSegment } from "@/utils/segments"

export interface SelectionSnapshot {
  /** The selection in order, so the bubble can render code as code. */
  segments: SelectionSegment[]
  /** The selection's box, for placing the bubble. */
  rect: DOMRect
}

/** Elements whose text is code rather than prose. */
const CODE_SELECTOR = "pre, code, kbd, samp"

/**
 * Elements that start a new line in `Selection.toString()`.
 *
 * The text is rebuilt from the DOM rather than read off the selection, so these boundaries have
 * to be re-created by hand: without them the paragraphs of a multi-paragraph selection would
 * run together into a single sentence, both in the preview and in the translator's input.
 *
 * This mirrors what Blink's text extraction does for the structures we expect to meet. It is an
 * approximation, not a re-implementation: a structure missing from this list simply gets no line
 * break, which costs a little translation quality but never correctness, and adding one is a
 * one-line fix.
 */
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIELDSET",
  "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER",
  "HGROUP", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD",
  "TFOOT", "TH", "THEAD", "TR", "UL",
])

/** Selections inside form controls or editable regions are not translated. */
function isInsideEditableElement(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement
  if (!element) {
    return false
  }

  return element.closest("input, textarea, [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only'], [role='textbox']") !== null
}

/** Returns the selection split into translatable text and code, or `null` if it is too small. */
export function readSelection(minCharacters: number): SelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  // Both ends are checked: a drag that starts in prose can end inside an editable region.
  if (isInsideEditableElement(selection.anchorNode) || isInsideEditableElement(selection.focusNode)) {
    return null
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  const segments = normalizeSegments(collectSegments(range))
  const text = translatableText(segments)
  const hasText = segments.some(segment => segment.kind === "text")

  // Code-only selections do not open the bubble. When prose is present, the minimum
  // character floor applies to the translatable text.
  if (!hasText || text.length < minCharacters) {
    return null
  }

  return { segments, rect }
}

/**
 * A code element is a code *block* when it sits inside `<pre>`; a block is code in full when it
 * holds nothing but code elements.
 *
 * Inline code inside a sentence stays in the text. Cutting `pnpm build` out of "Run `pnpm build`
 * to build" would hand the translator a sentence with a hole in it, which reads worse than the
 * one identifier it might translate oddly.
 */
function isCodeContent(element: Element): boolean {
  if (element.matches(CODE_SELECTOR)) {
    return element.closest("pre") !== null
  }

  // `<p><code>a</code> <code>b</code></p>` is a code block, so the whitespace between the spans
  // belongs to the code too — otherwise it would survive as a whitespace-only "translatable" text.
  const children = Array.from(element.childNodes)
  return children.some(isCodeElement)
    && children.every(child => isCodeElement(child) || isIgnorableInsideCode(child))
}

function isCodeElement(node: Node): boolean {
  return node instanceof Element && node.matches(CODE_SELECTOR)
}

/** Whitespace between two code elements, and the `<br>` line breaks inside a code block. */
function isIgnorableInsideCode(node: Node): boolean {
  if (node instanceof Text) {
    return node.data.trim() === ""
  }

  return node instanceof Element && node.tagName === "BR"
}

/** Whether the element or one of its ancestors is code, i.e. the element's text is not translated. */
function isInsideCode(element: Element | null): boolean {
  for (let current = element; current !== null; current = current.parentElement) {
    if (isCodeContent(current)) {
      return true
    }
  }
  return false
}

/** What the walk knows about the text it is standing in. */
interface WalkContext {
  /** Inside a code block: the text is kept verbatim and never translated. */
  code: boolean
  /** `white-space` keeps the source's line breaks (`pre`, `pre-wrap`, `pre-line`, …). */
  preserveWhitespace: boolean
}

function collectSegments(range: Range): SelectionSegment[] {
  const segments: SelectionSegment[] = []
  const root = range.commonAncestorContainer

  // The selection can sit entirely inside code, in which case the walk below never sees the
  // element that makes it code — it starts after it. Read that off the DOM once, up front.
  const rootElement = root instanceof Element ? root : root.parentElement
  const rootStyle = rootElement === null ? null : getComputedStyle(rootElement)
  const context: WalkContext = {
    code: isInsideCode(rootElement),
    preserveWhitespace: rootStyle !== null && preservesWhitespace(rootStyle),
  }

  if (root.nodeType === Node.TEXT_NODE) {
    appendText(segments, context, selectedTextOf(range, root as Text))
    return segments
  }

  for (const child of root.childNodes) {
    if (range.intersectsNode(child)) {
      visitRange(range, child, context, segments)
    }
  }

  return segments
}

function preservesWhitespace(style: CSSStyleDeclaration): boolean {
  return /pre|break-spaces/.test(style.whiteSpace)
}

function visitRange(range: Range, node: Node, context: WalkContext, segments: SelectionSegment[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    appendText(segments, context, selectedTextOf(range, node as Text))
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const element = node as Element
  const kind = context.code ? "code" : "text"

  if (element.tagName === "BR") {
    appendRaw(segments, kind, "\n")
    return
  }

  const isBlock = BLOCK_TAGS.has(element.tagName)
  const childContext: WalkContext = {
    code: context.code || isCodeContent(element),
    preserveWhitespace: preservesWhitespace(getComputedStyle(element)),
  }

  if (isBlock) {
    appendLineBreak(segments, kind)
  }
  for (const child of element.childNodes) {
    if (range.intersectsNode(child)) {
      visitRange(range, child, childContext, segments)
    }
  }
  if (isBlock) {
    appendLineBreak(segments, kind)
  }
}

/**
 * The part of a text node the range covers.
 *
 * A range whose boundary sits inside a text node has that node as its boundary container, so the
 * offset can be used as is; anything else means the node is covered whole.
 */
function selectedTextOf(range: Range, node: Text): string {
  const { data } = node
  const startsInsideNode = range.comparePoint(node, 0) < 0
  const endsInsideNode = range.comparePoint(node, data.length) > 0

  return data.slice(startsInsideNode ? range.startOffset : 0, endsInsideNode ? range.endOffset : data.length)
}

/**
 * Adds a text node's selected slice, with its whitespace the way the page renders it.
 *
 * A text node holds the HTML source as written: a paragraph hard-wrapped at 80 columns has a
 * newline and an indent inside every sentence, which the browser renders as one space. Left in,
 * each of those newlines would read as a paragraph break — the only meaning `\n` has in a
 * segment — and split the sentence across requests. So prose gets CSS's whitespace collapsing:
 * a run becomes one space, and a space at a line start is dropped. Code, and text whose
 * `white-space` keeps line breaks, is taken as written.
 */
function appendText(segments: SelectionSegment[], context: WalkContext, text: string): void {
  if (context.code) {
    appendRaw(segments, "code", text)
    return
  }
  if (context.preserveWhitespace) {
    appendRaw(segments, "text", text)
    return
  }

  const collapsed = text.replace(/[ \t\n\r\f]+/g, " ")
  const last = segments[segments.length - 1]
  const atLineStart = last === undefined || (last.kind === "text" && /[ \n]$/.test(last.text))
  appendRaw(segments, "text", atLineStart ? collapsed.replace(/^ /, "") : collapsed)
}

function appendRaw(segments: SelectionSegment[], kind: SelectionSegment["kind"], text: string): void {
  if (!text) {
    return
  }

  const last = segments[segments.length - 1]
  if (last?.kind === kind) {
    last.text += text
    return
  }

  segments.push({ kind, text })
}

/** Block boundaries collapse: two paragraphs are one line break apart, not two. */
function appendLineBreak(segments: SelectionSegment[], kind: SelectionSegment["kind"]): void {
  const last = segments[segments.length - 1]
  if (last?.kind === kind) {
    // The space a collapsed run left at the end of the line is not rendered either.
    if (kind === "text") {
      last.text = last.text.replace(/ +$/, "")
    }
    if (last.text.endsWith("\n")) {
      return
    }
  }

  appendRaw(segments, kind, "\n")
}

/**
 * Trims each code block, and the block separators the walk added at the ends of the selection.
 *
 * Code blocks stand on their own, so their own edges are trimmed. Only the outermost *text*
 * segments are trimmed as well: the whitespace between them is the space between two sentences
 * (or the blank line a code block leaves behind), which the translator should see.
 */
function normalizeSegments(segments: SelectionSegment[]): SelectionSegment[] {
  const kept = segments
    .map(segment => (segment.kind === "code" ? { kind: segment.kind, text: segment.text.trim() } : segment))
    .filter(segment => segment.text !== "")

  const firstText = kept.findIndex(segment => segment.kind === "text")
  const lastText = kept.findLastIndex(segment => segment.kind === "text")

  return kept
    .map((segment, index) => {
      if (segment.kind !== "text") {
        return segment
      }

      // When the selection is a single text segment, both trims apply to it, one after the other.
      const text = index === firstText ? segment.text.trimStart() : segment.text
      return { kind: segment.kind, text: index === lastText ? text.trimEnd() : text }
    })
    .filter(segment => segment.text !== "")
}