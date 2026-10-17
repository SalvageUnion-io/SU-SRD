/**
 * Built-in "Starter Set" roster — the pre-generated crew from the Salvage
 * Union Starter Set adventure *Reclamation of the Wastes*: the six pilots of
 * Union Crawler #430 'Tenacity', each with their mech, plus the crawler and its
 * crew, wired together with SoftLinks.
 *
 * Design:
 *   - Every record here is FULLY STATIC plain data — hard-coded reference slugs
 *     (chassis/systems/modules/class/ability/equipment/crawler type/bays), so
 *     nothing here resolves against `salvageunion-reference` at runtime.
 *   - IDs are DETERMINISTIC (`starter-*`), so every browser holds the same set.
 *   - `createdAt`/`updatedAt` are a FIXED constant for the same determinism —
 *     these rows never sort ahead of the user's own newest-first builds.
 *   - Every record is stamped `gameId: null` — the **Shelf** (ADR-030 §2).
 *     A player copies from the set, never into it: see `copyStarter.ts`.
 *
 * Slugs verified against the reference dataset — the seed test
 * (`__tests__/starterSet.test.ts`) fails if any ref stops resolving.
 *
 * Known fidelity gaps (both minor, flagged deliberately):
 *   - The Mule's "Cooling Module" has no entry in the reference `modules`
 *     dataset, so it is omitted (only its `comms-module` is seeded). Adding it
 *     would be a reference-package data change out of scope here.
 *   - The Armament Bay's mounted Mini Mortar is not pre-selected: that bay
 *     choice is a `schema`-only picker whose stored value format we do not
 *     assert, so we leave it unselected rather than seed a wrong value.
 */
import type { Crawler } from '../schemas/crawler';
import type { Mech } from '../schemas/mech';
import type { Pilot } from '../schemas/pilot';
import type { SoftLink } from '../schemas/softLink';
export declare const STARTER_PILOTS: readonly Pilot[];
export declare const STARTER_MECHS: readonly Mech[];
export declare const STARTER_CRAWLERS: readonly Crawler[];
export declare const STARTER_SOFT_LINKS: readonly SoftLink[];
