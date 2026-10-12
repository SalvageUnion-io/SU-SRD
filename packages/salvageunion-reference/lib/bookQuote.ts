/**
 * Book text quoted in TypeScript rather than in `data/`: a wizard step's rule,
 * a stat's hint. Wrapping a quote marks it as the book's words, so the
 * rules-fidelity lock holds it to the book like any data string:
 * `collectProse` (`packages/gates/lib/proseFidelity.ts`) finds every call,
 * `check-rules-fidelity.ts --update` records a verdict for it, and the
 * `rules-fidelity` gate fails an edit nobody has compared with the book.
 *
 * The scan reads the source, not a running program, so both arguments must be
 * literals: an object of literal `source`, optional `booklet` and `page`, and a
 * string literal (or a template with no `${}`). Text the app writes itself,
 * or text with a value spliced in, is not a quote and stays unwrapped.
 */
import type { SourceSchema } from './schemas/enums'
import type { z } from './zod'

/** Where a quote is printed: the book, and for a boxed set, the booklet. */
export type BookAnchor = {
  source: z.infer<typeof SourceSchema>
  booklet?: string
  page: number
}

/** The quoted text, unchanged: the call exists for the fidelity scan. */
export function bookQuote(_anchor: BookAnchor, text: string): string {
  return text
}
