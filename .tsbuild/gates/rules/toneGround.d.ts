/**
 * The tech-level ground rule — the `tone-ground` rule set of `tools/check-rule-sets.ts`.
 *
 * Ruleset §3.8: **TL is the framed ink-on-paper badge, never a text ground.** A
 * tech-level blue (`--color-tl-1`…`-6`, `-b`, `-n`) is the badge's ramp; no
 * header band, and so no title, sits on one. An audit found systems and
 * modules wearing TL-1 sky blue as their header fill, with ink titles, under the
 * green Mech Workshop band: on the mech sheet they read as a second product.
 *
 * ## Why it reads the dataset, not the source
 *
 * Every header ground — Row, Card and Page, SRD and the Cantina — is the entity
 * model's tone token (`entityTone`, `packages/salvageunion-reference/lib/view/
 * parts/fill.ts`), painted as `--color-<token>`. No source file spells a TL
 * ground out; the resolver builds it from data. So the rule asks the resolver,
 * entity by entity, what ground each "have" header takes (the ink banner of a
 * "do" entity is never toned), and fails on any `tl-*`.
 *
 * ## The book's own TL grounds
 *
 * Systems and modules are headed in their tech level's blue in the book
 * itself: every entry and every index row, under the green Mech Workshop band
 * (Core Book pp. 162–164, 188–190). The owner ruled they follow the book, so
 * they are exempt by design, not pending (`BOOK_TL_GROUNDS`).
 *
 * ## Pending schemas
 *
 * The rest of the gear (equipment, drones, vehicles) and the tech-level
 * entries themselves still ride the ramp, undecided. They are listed below
 * with their reason, and an entry that no longer paints a TL ground fails as
 * stale, so the list only burns down.
 */
import type { RuleSet } from '../lib/ruleEngine';
export declare const DATA_DIR = "packages/salvageunion-reference/data";
/** Schemas whose headers still paint a TL ground, each with why. */
export declare const PENDING_TL_GROUNDS: Readonly<Record<string, string>>;
export declare const toneGround: RuleSet;
