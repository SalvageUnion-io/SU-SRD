/**
 * Per-surface Change Log provenance tags (ADR-022).
 *
 * `entityStore.update` / `.transfer` accept a `ChangeMeta`, but for a long
 * stretch nothing passed one: `kind: 'transaction'` and every `source` value
 * existed only in a doc comment on the store, so **every** entry persisted as
 * `manual` / `unknown` — a Dashboard Push was indistinguishable from someone
 * typing in a box, and the drawer's transaction badge could never render.
 *
 * These constants exist so the tag is declared once per surface rather than
 * re-typed at ~50 call sites, where it would drift. That only holds because the
 * parameter is **required**: while it was optional the guarantee was advisory,
 * and five call sites duly drifted back to the `manual`/`unknown` default
 * without anything failing. Pick by the surface's enforcement mode (ADR-021),
 * not by what the patch happens to touch:
 *
 * - **Guided Play** (Dashboard) and **Guided Creation** (Wizard) run enforced
 *   lifecycle transactions → `transaction`.
 * - **Free Edit** (Live Sheet) edits state directly → `manual`, or `override`
 *   when pinning a quantitative cap.
 *
 * With one recorded exception: a handful of sanctioned Live-Sheet controls run a
 * real transaction (the crawler economy, bay Repair, per-card repair) and tag
 * `LIVE_SHEET_TXN`. That list is closed and lives in
 * `docs/architecture/rules-engine-boundary.md` — do not add to it here.
 */
import type { ChangeMeta } from './entityStore'

/** Guided Play — an enforced lifecycle transaction (use a system, Push, damage). */
export const DASHBOARD_TXN: ChangeMeta = { kind: 'transaction', source: 'dashboard' }

/** Guided Creation — an enforced creation-time transaction. */
export const WIZARD_TXN: ChangeMeta = { kind: 'transaction', source: 'wizard' }

/** Free Edit — a direct hand edit of entity state. */
export const LIVE_SHEET_MANUAL: ChangeMeta = { kind: 'manual', source: 'live-sheet' }

/** Free Edit — pinning or reverting a quantitative cap (ADR-022 stat override). */
export const LIVE_SHEET_OVERRIDE: ChangeMeta = { kind: 'override', source: 'live-sheet' }

/**
 * A sanctioned Live-Sheet lifecycle transaction — the crawler economy's Upkeep
 * draw, Deterioration roll, Upgrade and Scrap exchange.
 *
 * `transaction`, because that is what it is: Scrap left the pool by a rule, and
 * a d20 decided the outcome. Tagging these `LIVE_SHEET_MANUAL` made the Change
 * Log read as if the player had typed the numbers in — "who dropped our SP by
 * 5" answered with "somebody hand-edited it", when the honest answer was
 * "failed Upkeep, rolled 14". `source` still says `live-sheet` so the drawer can
 * tell it apart from a Dashboard transaction.
 */
export const LIVE_SHEET_TXN: ChangeMeta = { kind: 'transaction', source: 'live-sheet' }

/**
 * Moving an entity between containers — a Game or the Shelf (ADR-030 §2).
 *
 * A transaction rather than a manual edit: `gameId` is not a field somebody
 * types, it is the outcome of an enforced hand-off, and logging it as a hand
 * edit made "who moved this pilot out of our Game" unanswerable.
 */
export const CONTAINER_MOVE: ChangeMeta = { kind: 'transaction', source: 'container' }
