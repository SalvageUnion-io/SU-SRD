/**
 * A headline label quoted from a table entry's own text.
 *
 * ## Why it quotes rather than writes
 *
 * These labels are **the book's own words, verbatim**, not summaries. This repo
 * does not invent game content, and a label is content: it renders as the name
 * of an outcome. So the rule is deliberately narrow — take the entry's leading
 * sentence if it already reads as a name, and otherwise produce nothing.
 *
 * ## Why it never truncates
 *
 * A cut label breaks mid-phrase. A sentence that does not already fit is
 * refused, so a derived label is always a whole thought.
 *
 * ## Why a failure produces nothing rather than a tier word
 *
 * Falling back to the Core Mechanic band names would put **SUCCESS** over
 * "your Union Crawler is inoperable and grounded" — the band vocabulary
 * describes how well the *d20* went, not what the table says happened. Where
 * quoting fails the existing rule applies unchanged, which asserts nothing.
 */

/**
 * Longest quotable sentence.
 *
 * Chosen typographically rather than from the data: a `##` headline renders
 * around 27px and a container is roughly 320px wide on a phone, so ~52
 * characters is about two lines — still a headline. Past that it is prose set
 * in display type.
 */
const MAX_QUOTED = 52

/** A quoted headline and whatever of the entry is left to say beneath it. */
export type DerivedLabel = {
  /** The entry's leading sentence, verbatim. */
  label: string
  /** The rest of the entry, or undefined when the label was the whole of it. */
  rest?: string
}

/**
 * Split an entry into a quoted headline and its remainder.
 *
 * The quoted sentence moves to the headline, so it is removed from the body
 * (`rest`) rather than repeated beneath it.
 */
export function deriveLabel(value: string): DerivedLabel | undefined {
  if (!value) return undefined
  const [first, ...tail] = value.split(/(?<=[.!?])\s/)
  if (first === undefined) return undefined
  const label = first.trim().replace(/\.$/, '')
  // Would need cutting to fit, so it is prose rather than a name.
  if (label.length > MAX_QUOTED) return undefined
  // A single word is a fragment, not an outcome name.
  if (label.split(/\s+/).length < 2) return undefined
  const rest = tail.join(' ').trim()
  return { label, rest: rest.length > 0 ? rest : undefined }
}
