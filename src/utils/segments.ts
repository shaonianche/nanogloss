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
