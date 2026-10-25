/**
 * Per-surface Change Log provenance tags (ADR-022).
 *
 * `units.update` / `.transfer` take a `ChangeMeta`, so a Push in Play
 * reads as a transaction in the Change Log, never as someone typing in a box,
 * and the drawer's transaction badge can render.
 *
 * These constants declare the tag once per surface rather than re-typed at
 * ~50 call sites, where it would drift. That holds because the parameter is
 * **required**: an optional one would let a call site fall back to the
 * `manual`/`unknown` default without anything failing. Pick by the surface's
 * enforcement mode (ADR-021),
 * not by what the patch happens to touch:
 *
 * - **Guided Play** (Play) and **Guided Creation**
 *   (Wizard) run enforced lifecycle transactions → `transaction`.
 * - **Free Edit** (Live Sheet) edits state directly → `manual`, or `override`
 *   when pinning a quantitative cap.
 *
 * With one recorded exception: a handful of sanctioned Live-Sheet controls run a
 * real transaction (the crawler economy, bay Repair, per-card repair) and tag
 * `LIVE_SHEET_TXN`. That list is closed and lives in
 * `docs/ARCHITECTURE.md#live-sheet` — do not add to it here.
 */
import type { ChangeLogKind } from 'game-domain/schemas/changeLog'

/**
 * The provenance every op carries (ADR-022, ADR-063): its `kind` and the
 * surface it came from. Both are required, and so is the parameter that
 * carries them, so a forgotten tag is a compile error rather than a row that
 * reads as a hand edit.
 */
export type ChangeMeta = {
  kind: ChangeLogKind
  source: string
}

/**
 * Guided Play (ADR-051): an enforced lifecycle transaction (a vital's − / +,
 * use a system, Push, Vent, apply a Downtime step, a roll on the Game's log).
 * Rows the retired Dashboard wrote carry `source: 'dashboard'`.
 */
export const PLAY_TXN: ChangeMeta = { kind: 'transaction', source: 'play' }

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
 * a d20 decided the outcome. Tagged `LIVE_SHEET_MANUAL`, the Change Log would
 * read as if the player had typed the numbers in — "who dropped our SP by 5"
 * answered with "somebody hand-edited it", when the honest answer is "failed
 * Upkeep, rolled 14". `source` still says `live-sheet` so the drawer can
 * tell it apart from a Play transaction.
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
