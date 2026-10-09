/**
 * Change Log (provenance) — the per-entity, append-only audit trail
 * ([ADR-022](../../../../../docs/ARCHITECTURE.md#adr-022)).
 *
 * Every mutation to a player entity, on every surface, appends a Change Log
 * entry — _all_ changes, not just overrides. Each entry is tagged with its
 * provenance `kind`:
 *   - `transaction` — an enforced lifecycle event (Guided Creation / Guided
 *     Play): "spent 3 scrap to install Coilgun", "Push: +2 heat".
 *   - `override`    — a Free-Edit cap/maximum override on the Live Sheet:
 *     "cap override: maxSP 12 → 16".
 *   - `manual`      — a Free-Edit hand-edit of free state: "currentHeat → 0".
 *
 * Entries are **append-only, ordered, and replay-shaped** — each carries the
 * target `field`, `before`/`after`, provenance `kind`, and `source` surface,
 * so state can be reconstructed by replay. A player-facing replay/time-travel
 * surface is explicitly out of scope (ADR-022): we build the log so replay is
 * _possible_, not the replay UI.
 *
 * The log lives only on the server (`convex/changeLog.ts`); there is no device
 * copy, and it never travels with a public sheet.
 */

/** Provenance classes, in the order ADR-022 lists them. */
const CHANGE_LOG_KINDS = ['transaction', 'override', 'manual'] as const
export type ChangeLogKind = (typeof CHANGE_LOG_KINDS)[number]
