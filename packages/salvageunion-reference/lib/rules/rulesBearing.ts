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

/** Sentences claiming a change to a derived MAXIMUM or a slot count. */
export const CAP_CLAIM_PATTERN =
  /(increase|reduce|decrease|gain|add)\w*\s+(?:your|their|its|the|a)?\s*[A-Za-z' ]{0,30}?(Max(?:imum)?\s+(?:SP|HP|EP|AP|Structure Points|Hit Points|Energy Points|Heat)|Cargo Capacity|Inventory Capacity|Heat Capacity|(?:System|Module) Slot)/i

/** Sentences claiming a trait, damage or range change. */
export const EFFECT_CLAIM_PATTERN =
  /(gains?\s+the\s+[A-Z][A-Za-z ]{2,24}\s*(?:Trait|trait)|(?:additional|extra|\+\s*\d+)\s+\w*\s*(?:SP|HP)?\s*damage|(?:increase|extend)\w*[^.]{0,30}Range band)/i

/**
 * What kind of mechanical change this text claims, if any.
 *
 * Returns the first class that matches; `cap` wins over `effect` when a
 * sentence somehow reads as both, because a maximum is the more specific claim.
 */
export function statesMechanicalChange(text: string | undefined): RulesClaim | null {
  if (!text) return null
  if (CAP_CLAIM_PATTERN.test(text)) return 'cap'
  if (EFFECT_CLAIM_PATTERN.test(text)) return 'effect'
  return null
}
