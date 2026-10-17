/**
 * One class prefix — the `class-prefix` rule set of `tools/check-rule-sets.ts`.
 *
 * Every class the app's stylesheets author is `su-*` (the Dashboard's
 * `su-dash-*` among them; `.claude/rules/styling.md`). The Cantina once grew `wiz-`,
 * `header-menu-`, `npc-`, `shelves-` and a dozen more families beside some 800
 * `su-` selectors, and the UI library's tone contexts were `sheet--{kind}`: two
 * naming schemes for one stylesheet system, with nothing to say which a new
 * class should take. A wrong prefix compiles and renders, so only a scan
 * catches it.
 */
import type { RuleSet } from '../lib/ruleEngine';
export declare const classPrefix: RuleSet;
