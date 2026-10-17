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
export type RulesClaim = 'cap' | 'effect';
/**
 * What kind of mechanical change this text claims, if any.
 *
 * `cap` wins over `effect` when a sentence reads as both, because a maximum is
 * the more specific claim.
 */
export declare function statesMechanicalChange(text: string | undefined): RulesClaim | null;
