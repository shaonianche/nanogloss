/**
 * The selection's content model, shared by the selection reader (content script), the
 * translation controller, and the surfaces that render a selection:
 * - `text`: prose to translate
 * - `code`: block-level code, kept verbatim and excluded from translation
 * - `inline-code`: inline `<code>`, `<kbd>`, `<samp>`, `<var>`, protected with placeholders
 * - `inline-literal`: `[translate="no"]`, `.notranslate`, math, URLs, and template variables,
 *   protected with placeholders and rendered as normal inline text
 */

export type InlineProtectedKind = "inline-code" | "inline-literal"

export interface SelectionSegment {
  kind: "text" | "code" | InlineProtectedKind
  /** The selected slice, in document order. */
  text: string
}

export interface ProtectedPlaceholder {
  index: number
  kind: InlineProtectedKind
  text: string
}

export interface PreparedTranslationInput {
  /** Text with inline protected segments replaced by placeholders. */
  maskedText: string
  /** Plain unmasked text (used for language detection and fallback). */
  plainText: string
  placeholders: ProtectedPlaceholder[]
}

export interface TranslationRun {
  kind: "text" | InlineProtectedKind
  text: string
}

/**
 * Matches high-confidence inline literals inside plain prose:
 * - HTTP(S) URLs
 * - Template variables: `{{...}}`, `${...}`, `__MSG_...__`, `{0}`, `%s`/`%d`/`%f`/`%i`
 */
const INLINE_LITERAL_PATTERN = /https?:\/\/[^\s<>"'`]+|\{\{[^{}\n]{1,64}\}\}|\$\{[^{}\n]{1,64}\}|__MSG_[A-Za-z0-9_]+__|\{\d+\}|(?<![A-Za-z0-9_])%(?:[sdif]|\.\d+f)(?![A-Za-z0-9_])/g

const TRAILING_URL_PUNCTUATION = /[.,;:!?)\]}]+$/

/**
 * Splits high-confidence URLs and template variables out of `text` segments into
 * `inline-literal` segments so they are protected during translation.
 */
export function extractInlineLiterals(segments: SelectionSegment[]): SelectionSegment[] {
  const result: SelectionSegment[] = []

  for (const segment of segments) {
    if (segment.kind !== "text") {
      result.push(segment)
      continue
    }

    let cursor = 0
    for (const match of segment.text.matchAll(INLINE_LITERAL_PATTERN)) {
      const start = match.index ?? 0
      let matched = match[0]

      // Strip trailing sentence punctuation from URLs (e.g. "See https://example.com.").
      if (matched.startsWith("http://") || matched.startsWith("https://")) {
        matched = matched.replace(TRAILING_URL_PUNCTUATION, "")
      }

      if (matched.length === 0) {
        continue
      }

      if (start > cursor) {
        result.push({ kind: "text", text: segment.text.slice(cursor, start) })
      }
      result.push({ kind: "inline-literal", text: matched })
      cursor = start + matched.length
    }

    if (cursor < segment.text.length) {
      result.push({ kind: "text", text: segment.text.slice(cursor) })
    }
  }

  return result
}

/** Whether the selection contains any prose worth translating (not just code or literals). */
export function hasTranslatableProse(segments: SelectionSegment[]): boolean {
  return segments.some(segment => segment.kind === "text" && segment.text.trim() !== "")
}

/**
 * Everything that is not block-level code, joined the way the translator should see it.
 *
 * This is the plain unmasked input (used for language detection, min-character gating, and
 * fallback when placeholder restoration fails).
 */
export function translatableText(segments: SelectionSegment[]): string {
  return segments
    .filter(segment => segment.kind !== "code")
    .map(segment => segment.text)
    .join("")
    .trim()
}

/** Format of a placeholder token sent to the translator. */
export function placeholderToken(index: number): string {
  return `⟦${index}⟧`
}

const PLACEHOLDER_REGEX = /⟦\s*(\d+)\s*⟧/g
const TRAILING_PARTIAL_PLACEHOLDER = /⟦\s*\d*\s*$/

/**
 * Prepares segments for translation by extracting plain-text literals and replacing all
 * `inline-code` and `inline-literal` segments with indexed placeholders.
 */
export function prepareTranslationInput(segments: SelectionSegment[]): PreparedTranslationInput {
  const expanded = extractInlineLiterals(segments)
  const placeholders: ProtectedPlaceholder[] = []
  const parts: string[] = []

  for (const segment of expanded) {
    if (segment.kind === "code") {
      continue
    }
    if (segment.kind === "text") {
      parts.push(segment.text)
      continue
    }

    const index = placeholders.length
    placeholders.push({ index, kind: segment.kind, text: segment.text })
    parts.push(placeholderToken(index))
  }

  return {
    maskedText: parts.join("").trim(),
    plainText: translatableText(segments),
    placeholders,
  }
}

/**
 * Restores placeholders in a completed translation into typed runs.
 * Returns `null` if any placeholder was dropped, duplicated, or altered by the model,
 * signalling the caller to fall back to unmasked translation.
 */
export function restoreTranslationRuns(
  translated: string,
  placeholders: ProtectedPlaceholder[],
): TranslationRun[] | null {
  if (placeholders.length === 0) {
    return translated === "" ? [] : [{ kind: "text", text: translated }]
  }

  const runs: TranslationRun[] = []
  const seen = new Set<number>()
  let cursor = 0

  for (const match of translated.matchAll(PLACEHOLDER_REGEX)) {
    const start = match.index ?? 0
    const index = Number(match[1])
    const placeholder = placeholders[index]

    if (!placeholder || seen.has(index)) {
      return null
    }
    seen.add(index)

    if (start > cursor) {
      runs.push({ kind: "text", text: translated.slice(cursor, start) })
    }
    runs.push({ kind: placeholder.kind, text: placeholder.text })
    cursor = start + match[0].length
  }

  if (seen.size !== placeholders.length) {
    return null
  }

  if (cursor < translated.length) {
    runs.push({ kind: "text", text: translated.slice(cursor) })
  }

  // Reject if a stray delimiter survived in the text.
  if (runs.some(run => run.kind === "text" && /[⟦⟧]/.test(run.text))) {
    return null
  }

  return runs
}

/**
 * Restores completed placeholders during streaming while hiding any incomplete trailing
 * placeholder token so raw markers never flash in the UI.
 */
export function restorePartialRuns(
  partial: string,
  placeholders: ProtectedPlaceholder[],
): TranslationRun[] {
  if (placeholders.length === 0) {
    return partial === "" ? [] : [{ kind: "text", text: partial }]
  }

  const clean = partial.replace(TRAILING_PARTIAL_PLACEHOLDER, "")
  const runs: TranslationRun[] = []
  let cursor = 0

  for (const match of clean.matchAll(PLACEHOLDER_REGEX)) {
    const start = match.index ?? 0
    const index = Number(match[1])
    const placeholder = placeholders[index]
    if (!placeholder) {
      continue
    }

    if (start > cursor) {
      runs.push({ kind: "text", text: clean.slice(cursor, start) })
    }
    runs.push({ kind: placeholder.kind, text: placeholder.text })
    cursor = start + match[0].length
  }

  if (cursor < clean.length) {
    runs.push({ kind: "text", text: clean.slice(cursor) })
  }

  return runs
}

export function runsToPlainText(runs: TranslationRun[]): string {
  return runs.map(run => run.text).join("")
}

/** Longest request the translator is asked for at once. */
export const TRANSLATION_CHUNK_TARGET = 600

/**
 * Splits the translator's input into the requests it is asked for.
 *
 * The Translator API processes translations sequentially, so one long request blocks the queue
 * for as long as it runs; the Chrome docs therefore ask for chunking. Paragraphs are the natural
 * cut: they keep each request self-contained, the parts come back in the reading order, and the
 * caller joins them with the blank line they were split on. Short paragraphs are packed together
 * up to the target, so a selection of one-liners does not turn into a request per line. A single
 * paragraph longer than the target stays whole — splitting inside a paragraph would cut a
 * sentence from its context, and the streaming result already reaches the reader early.
 */
export function translationChunks(text: string, maxChars = TRANSLATION_CHUNK_TARGET): string[] {
  const trimmed = text.trim()
  if (trimmed === "") {
    return []
  }
  if (trimmed.length <= maxChars) {
    return [trimmed]
  }

  const chunks: string[] = []
  for (const paragraph of trimmed.split(/\n+/).map(line => line.trim()).filter(line => line !== "")) {
    const last = chunks[chunks.length - 1]
    if (last !== undefined && last.length + paragraph.length + 2 <= maxChars) {
      chunks[chunks.length - 1] = `${last}\n\n${paragraph}`
    }
    else {
      chunks.push(paragraph)
    }
  }
  return chunks
}
