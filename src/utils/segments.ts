/**
 * The selection's content model, shared by the selection reader (content script), the
 * translation controller, and the surfaces that render a selection: prose to translate,
 * code to keep verbatim.
 */

export interface SelectionSegment {
  kind: "text" | "code"
  /** The selected slice, in document order. */
  text: string
}

/**
 * Everything that is not code, joined the way the translator should see it.
 *
 * This is the translator's input, so the block separators the walk added are dropped from either
 * end; the preview trims per segment instead, where the leading whitespace is still visible.
 */
export function translatableText(segments: SelectionSegment[]): string {
  return segments
    .filter(segment => segment.kind === "text")
    .map(segment => segment.text)
    .join("")
    .trim()
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
