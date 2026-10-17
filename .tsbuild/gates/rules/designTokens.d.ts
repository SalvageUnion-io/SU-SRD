/**
 * Design-token laws — the `tokens` rule set of `tools/check-rule-sets.ts`.
 *
 * Nothing enforced these laws before this rule set. That absence is why the
 * `su-*` shadow token family survived: the drift was never raw hex (which reads
 * as obviously wrong), it was a parallel token family that *looked* sanctioned
 * at every call site.
 *
 * Why this must exist as a build step rather than a review habit: these tokens
 * are CSS custom properties, so a deleted token does not fail typecheck — the
 * `var()` that reads it simply resolves to nothing and the element renders
 * unstyled.
 * There is no compiler backstop for this class of mistake. This rule set is it.
 *
 * Every rule maps to a law in docs/design-system/ruleset.md; the `rule` field
 * cites the section so a failure tells you which law you broke, not just which
 * regex you tripped.
 *
 * ## Every rule is zero
 *
 * Every rule here is `zero`: any finding fails, and none has a baseline entry.
 * `rust-allowlist` (§3.1), `type-floor` (§4.6) and `texture-placement` (§3.5)
 * hold the Workshop Manual canon the ruleset ratifies. The Discord bot's
 * hex-integer accents are exempt from `raw-color` below (Discord's API takes
 * integers, not CSS). Making a rule stricter means fixing or exempting what
 * it newly finds in the same commit; there is no baseline to raise.
 */
import type { Finding, RuleSet } from '../lib/ruleEngine';
/**
 * The px a font-size literal renders at, or `undefined` when it is not a
 * literal this can size (a retired rung's NAME, which is sub-floor by
 * definition). A unitless number is px, as a React style object reads it.
 */
export declare function fontSizePx(match: string): number | undefined;
/** Findings per rule for the given sources, keyed by repo-relative path. */
export declare function scanTokenSources(sources: ReadonlyMap<string, string>): Record<string, Finding[]>;
export declare const designTokens: RuleSet;
