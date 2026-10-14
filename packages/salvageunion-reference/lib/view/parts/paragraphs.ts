/**
 * Paragraphs for a narrow column: a Discord card breaks the book's long
 * paragraphs at their sentences.
 */

/** A paragraph longer than this is broken into shorter ones at its sentences. */
const PARAGRAPH_MAX = 300

/** A tail shorter than this joins the paragraph before it. */
const PARAGRAPH_MIN = 100

/**
 * A long paragraph as shorter ones, each whole sentences, the book's words
 * unchanged: a new paragraph opens once one passes `PARAGRAPH_MAX`, and a
 * short tail stays with the one before. A sentence ends at `.`, `!` or `?`
 * before a capital or a quote, so "e.g. a" and "p.23" never break.
 */
export function splitParagraph(text: string): string[] {
  if (text.length <= PARAGRAPH_MAX) return [text]
  const sentences = text.split(/(?<=[.!?]["']?)\s+(?=["'A-Z])/)
  const out: string[] = []
  for (const sentence of sentences) {
    const last = out.length - 1
    if (last >= 0 && (out[last] ?? '').length + sentence.length < PARAGRAPH_MAX) {
      out[last] = `${out[last]} ${sentence}`
    } else out.push(sentence)
  }
  const tail = out.at(-1)
  if (out.length > 1 && tail !== undefined && tail.length < PARAGRAPH_MIN) {
    out.pop()
    out[out.length - 1] = `${out.at(-1)} ${tail}`
  }
  return out
}
