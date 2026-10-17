/**
 * Styling-ownership laws — the `styling` rule set of `tools/check-rule-sets.ts`.
 *
 * The property this locks: **src/components is the single source of truth for all
 * components and shared styling.** An app is a composition root — it wires the
 * library's components to its own data — not a second design system. When an app
 * grows its own `@theme` tokens, its own orphaned CSS, or generic components that
 * never touch the library, the source-of-truth boundary has already been crossed;
 * the drift just hasn't been named yet. This rule set names it.
 *
 * Why a build step and not a review habit: like the design-token drift, none of
 * these violations fail typecheck. A stray app `@theme` block compiles. Dead CSS
 * compiles. A Dashboard `su-dash-*` class referenced but never defined renders
 * unstyled — no error, just a wrong-looking element.
 *
 * The analyses here are structural (cross-file reference graphs, brace-context
 * parsing) rather than per-line regexes, so each rule has its own scan function.
 * Every rule is `zero`: any finding fails.
 */
import type { RuleSet } from '../lib/ruleEngine';
export declare const stylingOwnership: RuleSet;
