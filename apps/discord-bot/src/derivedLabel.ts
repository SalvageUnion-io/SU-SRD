/**
 * A headline label quoted from a table entry's own text.
 *
 * ## Why this exists
 *
 * 76 of the 96 roll tables carry no `label` on any entry, so the headline rule
 * falls through to branch 3 and the `##` slot holds only the die plate. That is
 * already a large improvement on `Roll: 14`, but on a table whose entries run
 * long the reader gets a bare number over a wall of prose.
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
 * An earlier attempt cut the leading clause to fit, which produced headlines
 * that broke mid-phrase and repeated the body verbatim underneath:
 *
 *     ## ▌14▐ YOUR UNION CRAWLER IS INOPERABLE AND
 *     Your Union Crawler is inoperable and grounded. Its Bays are Intact, …
 *
 * That is worse than the bare plate it replaced. A sentence that does not
 * already fit is refused, so a derived label is always a whole thought.
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
 * Chosen typographically rather than from the data: quotable coverage rises
 * smoothly with the cap (51% at 40 chars, 64% at 52, 73% at 64) with no natural
 * cliff to anchor on. A `##` headline renders around 27px and a container is
 * roughly 320px wide on a phone, so ~52 characters is about two lines — still a
 * headline. Past that it is prose set in display type.
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
 * ## Why the remainder matters
 *
 * A first draft returned only the label and left the body as the whole value,
 * so the headline repeated the body's opening sentence word for word:
 *
 *     ## \u258C14\u2590 YOUR UNION CRAWLER IS INOPERABLE AND GROUNDED
 *     Your Union Crawler is inoperable and grounded. Its Bays are Intact, ...
 *
 * That is the same duplication that ruled out truncating, arriving by another
 * route. Quoting a sentence *promotes* it, so it has to leave the body rather
 * than be repeated in it.
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
