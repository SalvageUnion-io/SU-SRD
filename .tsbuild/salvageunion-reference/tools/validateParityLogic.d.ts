/**
 * Rules-parity audit (ADR-029 §5) — does content DENOTE the mechanical change
 * its rules text claims?
 *
 * The dataset states mechanical changes in prose. Some are encoded as structured
 * data the app can apply (`contributions`, crawler `mutations`, choice
 * `effects`); some are stated and encoded nowhere, so the number on the
 * sheet is simply wrong.
 *
 * This is the check that makes "content denotes what it claims" STAY true across
 * future content drops, rather than being a one-time sweep that silently rots.
 *
 * **It never infers a number from prose.** It only asks whether a record whose
 * text plainly states a mechanical change carries structured data OR a reasoned
 * exemption. Authoring the number is a human decision; this only refuses to let
 * one be forgotten.
 *
 * Burn-down, like `check:design-tokens`: a KNOWN set is tolerated so the check
 * can land while the backlog is worked off, and anything NEW fails immediately.
 */
type Json = Record<string, unknown>;
type ParityClass = 'cap' | 'effect';
export type ParityFinding = {
    /** Display name of the owning record. */
    record: string;
    /** Data file the record lives in, e.g. `abilities.json`. */
    schema: string;
    /** The sentence that states the change — quoted so triage needs no lookup. */
    sentence: string;
    klass: ParityClass;
    /** True when the record carries structured data for this class. */
    encoded: boolean;
    /** Set when the record is deliberately exempt; the string is the reason. */
    exempt?: string;
};
/**
 * The remaining backlog — records that state a change, are not exempt, and are
 * not yet encodable.
 *
 * Both need the SAME missing capability, and it is not the one first assumed.
 * Declaring effects directly on a system/ability is not the blocker: `ChoiceEffectSchema` has no TARGET, and
 * neither of these effects lands on the record that declares it.
 *
 *   Bio-Wings         "Your Mech gains the Fly Trait" — targets the HOST MECH.
 *                     Declared as a self-effect it would say the Bio-Wings
 *                     system flies, which is wrong, not merely incomplete.
 *   High Gain Antenna raises the Range band of OTHER installed Modules and
 *                     Pilot Abilities, filtered by trait — cross-item targeting
 *                     with a predicate.
 *
 * So closing these needs effects to gain a `target` (the same concept
 * `ContributionSchema` already carries), not just a new place to declare them.
 * Encoding them without it would apply real rules to the wrong entity — a
 * silent wrong answer, which is worse than a visible gap.
 *
 * A name that becomes encoded must be REMOVED from this list; the runner fails
 * on a stale entry, because a burn-down list that never shrinks is not burning
 * down.
 */
export declare const KNOWN_UNRESOLVED: readonly string[];
/**
 * Audit every record across every data file.
 *
 * `actions.json` holds most rules text, attributed back to its owner through
 * `actionSource`; a record's own fields are scanned too. The owning record is
 * what must carry the structured data, so a finding is reported against it.
 */
export declare function auditParity(filesByName: Record<string, Json[]>): ParityFinding[];
/** Findings that are neither encoded nor exempt — the remaining backlog. */
export declare function unresolvedFindings(findings: ParityFinding[]): ParityFinding[];
export {};
