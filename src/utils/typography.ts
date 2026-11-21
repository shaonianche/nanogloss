/** A run of text, and whether the browser may break a line inside it. */
export interface TextRun {
  text: string
  nowrap: boolean
}

/** A character that is neither a space nor a dash, followed by a run of CJK dashes (——, ――, ⸺). */
const DASH_RUN = /[^\s\u2014\u2015\u2E3A][\u2014\u2015\u2E3A]+/gu

/**
 * Splits text so each CJK dash run stays on one line with the character before it.
 *
 * W3C clreq's "strict" level forbids a dash at a line start (6.1.1), and Chrome's
 * `line-break: strict` stops one level short, so "他说——然后" can still break before the dash.
 * Rendering the character and its dashes as one `white-space: nowrap` run leaves no break
 * opportunity before the dash, while the breaks around the run stay. The text itself is not
 * changed, unlike a U+2060 word joiner, which would end up in the user's clipboard.
 */
export function bindDashes(text: string): TextRun[] {
  const runs: TextRun[] = []
  let last = 0
  for (const match of text.matchAll(DASH_RUN)) {
    if (match.index > last) {
      runs.push({ text: text.slice(last, match.index), nowrap: false })
    }
    runs.push({ text: match[0], nowrap: true })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    runs.push({ text: text.slice(last), nowrap: false })
  }
  return runs
}
