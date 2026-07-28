/**
 * Detecting prose that STATES a mechanical change (ADR-029).
 *
 * One detector, two consumers, deliberately:
 *
 *   - the **parity audit** (`tools/validateParityLogic.ts`) asks "does this
 *     record encode the change its text claims?"
 *   - the **entity card** marks the sentence that grants a contribution, so a
 *     reader can see which clause the app actually understands.
 *
 * They must never disagree. If the renderer marked a claim the audit did not
 * enforce, a record could look machine-backed while being inert — exactly the
 * state this whole effort exists to remove.
 *
 * This decides only whether prose *claims* something mechanical. It never
 * decides what the number is; inferring a value from prose is forbidden.
 */

export type RulesClaim = 'cap' | 'effect'

/**
 * Detection runs on WHITESPACE-NORMALISED text against patterns with no
 * adjacent whitespace quantifiers.
 *
 * The first version used `\s+(?:your|the)?\s*[A-Za-z\' ]{0,30}?` and friends,
 * whose neighbouring `\s+`/`\s*` backtrack polynomially over runs of spaces.
 * That was tolerable in a build-time tool over fixed data, but this module now
 * runs in the RENDER path on every paragraph, where content-controlled
 * whitespace becomes a denial-of-service surface. CodeQL flagged it as
 * `js/polynomial-redos`, correctly.
 *
 * Normalising first means every gap is exactly one space, so the patterns can
 * use literal spaces and keep the ORIGINAL semantics — the fix is linear, not
 * looser. A ReDoS fix that quietly widened what counts as a claim would change
 * the audit's scope under cover of a security patch.
 */

/** Collapse whitespace so no pattern ever sees a run to backtrack over. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ')
}

/** Claims a change to a derived MAXIMUM or a slot count. */
const CAP_PATTERNS: readonly RegExp[] = [
  /(?:increase|reduce|decrease|gain|add)\w* (?:your |their |its |the |a )?[A-Za-z' ]{0,30}?Max(?:imum)? (?:SP|HP|EP|AP|Structure Points|Hit Points|Energy Points|Heat)/i,
  /(?:increase|reduce|decrease|gain|add)\w* (?:your |their |its |the |a )?[A-Za-z' ]{0,30}?(?:Cargo|Inventory|Heat) Capacity/i,
  /(?:increase|reduce|decrease|gain|add)\w* (?:your |their |its |the |a )?[A-Za-z' ]{0,30}?(?:System|Module) Slot/i,
]

/** Claims a trait, damage or range change. */
const EFFECT_PATTERNS: readonly RegExp[] = [
  /gains? the [A-Z][A-Za-z ]{2,24}(?:Trait|trait)/,
  /(?:additional|extra|\+ ?\d+) (?:\w+ )?(?:SP |HP )?damage/i,
  /(?:increase|extend)\w* [^.]{0,30}Range band/i,
]

/**
 * What kind of mechanical change this text claims, if any.
 *
 * `cap` wins over `effect` when a sentence reads as both, because a maximum is
 * the more specific claim.
 */
export function statesMechanicalChange(text: string | undefined): RulesClaim | null {
  if (!text) return null
  const t = normalise(text)
  if (CAP_PATTERNS.some((re) => re.test(t))) return 'cap'
  if (EFFECT_PATTERNS.some((re) => re.test(t))) return 'effect'
  return null
}
