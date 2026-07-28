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
 * re-typed at ~50 call sites, where it would drift. Pick by the surface's
 * enforcement mode (ADR-021), not by what the patch happens to touch:
 *
 * - **Guided Play** (Dashboard) and **Guided Creation** (Wizard) run enforced
 *   lifecycle transactions → `transaction`.
 * - **Free Edit** (Live Sheet) edits state directly → `manual`, or `override`
 *   when pinning a quantitative cap.
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
