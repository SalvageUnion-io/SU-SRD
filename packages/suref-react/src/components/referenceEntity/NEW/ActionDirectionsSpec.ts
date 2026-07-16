/**
 * DESIGN EXPLORATION — candidate "action tells" (see
 * `ActionDirections.stories.tsx`).
 *
 * The problem: an ACTION card must read as VISUALLY DISTINCT from an entity
 * card while staying in the same four-band card family (seam / header /
 * sub-header / body). The rejected fix was a full rust body/band split.
 *
 * TWO SETS:
 * - D1–D6 (SUBTLE) — keep the HOST entity's own tone family and add ONE small
 *   distinguishing mark (glyph, cost, brackets, hairline, stamp, texture).
 * - D7–D10 (DRAMATIC) — a bigger colour departure from the entity card while
 *   still the same four-band shape: a unique light action hue, a ghosted host
 *   tone, an airy light wash, or a bold action-colour spine.
 */
export type ActionDirection =
  | 'glyph-badge'
  | 'cost-led'
  | 'corner-bracket'
  | 'hairline-rule'
  | 'seam-stamp'
  | 'textured-band'
  | 'action-colour'
  | 'ghosted'
  | 'light-wash'
  | 'action-spine'

export type ActionDirectionSpec = {
  direction: ActionDirection
  label: string
  /** One-line rationale of the tell this direction uses. */
  tell: string
}

/** The DRAMATIC subset (D7–D10) — a bigger colour departure, same four-band shape. */
export const DRAMATIC_DIRECTIONS: ReadonlySet<ActionDirection> = new Set<ActionDirection>([
  'action-colour',
  'ghosted',
  'light-wash',
  'action-spine',
])

export const ACTION_DIRECTIONS: ActionDirectionSpec[] = [
  {
    direction: 'glyph-badge',
    label: 'D1 · GLYPH BADGE',
    tell: 'A gear action-glyph chip rides the seam beside the type stamp — a MARK, not a colour, says "this one is performed".',
  },
  {
    direction: 'cost-led',
    label: 'D2 · COST-LED',
    tell: 'The full-size cost pennant LEADS the header before the name — an action is the thing you pay activation for.',
  },
  {
    direction: 'corner-bracket',
    label: 'D3 · CORNER BRACKETS',
    tell: 'The same bands inside a bracketed targeting frame — notched ink corners replace the plain 3px frame.',
  },
  {
    direction: 'hairline-rule',
    label: 'D4 · HAIRLINE RULE',
    tell: 'A thin rust hairline under the action name — the only rust that survives, structural accent instead of surface colour.',
  },
  {
    direction: 'seam-stamp',
    label: 'D5 · SEAM STAMP',
    tell: 'An enlarged, INVERTED action stamp on the seam — the label plate itself becomes the primary tell.',
  },
  {
    direction: 'textured-band',
    label: 'D6 · TEXTURED BAND',
    tell: 'The header band keeps the host tone but wears a fine ink hatch — same tone family, different surface finish.',
  },
  {
    direction: 'action-colour',
    label: 'D7 · UNIQUE ACTION HUE',
    tell: 'A light steel-blue that is NEITHER rust NOR the host tone — actions become their own cool, pale category across the bands.',
  },
  {
    direction: 'ghosted',
    label: 'D8 · GHOSTED TONE',
    tell: 'A washed-out, desaturated version of the HOST tone — an action reads as a faded relative of the entity, clearly secondary.',
  },
  {
    direction: 'light-wash',
    label: 'D9 · LIGHT WASH',
    tell: "A very pale tint of the tone floods the whole card, header a step deeper — airy and light against the entity's solid bands.",
  },
  {
    direction: 'action-spine',
    label: 'D10 · ACTION SPINE',
    tell: 'A bold action-hue spine down the left edge with paper-pale bands — a tabbed, filed-away read that is a big shape departure.',
  },
]
