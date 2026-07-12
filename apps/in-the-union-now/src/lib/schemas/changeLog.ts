import { z } from 'salvageunion-reference/zod'

/**
 * Change Log (provenance) — the per-entity, append-only audit trail
 * ([ADR-022](../../../../../docs/adrs/ADR-022-provenance-log-and-overrides.md)).
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
 * The log is **local only** — it lives in IndexedDB and never travels with a
 * published snapshot (a snapshot stays a frozen, historyless, bare-entity
 * payload).
 */

/** Provenance classes, in the order ADR-022 lists them. */
export const CHANGE_LOG_KINDS = ['transaction', 'override', 'manual'] as const
export const ChangeLogKindSchema = z.enum(CHANGE_LOG_KINDS)
export type ChangeLogKind = z.infer<typeof ChangeLogKindSchema>

/** The player entity types a Change Log entry can target. Mirrors EntityType. */
export const ChangeLogEntityTypeSchema = z.enum(['pilot', 'mech', 'crawler', 'softLink'])

/**
 * A single append-only Change Log entry.
 *
 * `seq` is the IndexedDB autoIncrement primary key — assigned by the store on
 * `add`, so it is absent on the input shape (see `ChangeLogInputSchema`) and
 * present on every persisted/read entry. It doubles as the total order.
 */
export const ChangeLogEntrySchema = z
  .object({
    /** IndexedDB autoIncrement key + total order. Assigned on write. */
    seq: z.number().int().positive(),
    entityType: ChangeLogEntityTypeSchema,
    entityId: z.string(),
    /** Epoch milliseconds (Date.now()) at write time. */
    ts: z.number().int().nonnegative(),
    kind: ChangeLogKindSchema,
    /** The mutated top-level field name (one entry per changed field). */
    field: z.string(),
    /** Prior value of `field` (undefined when the entity was not yet in memory). */
    before: z.unknown(),
    /** New value of `field` after the write. */
    after: z.unknown(),
    /** The surface that made the change, e.g. 'live-sheet', 'dashboard', 'wizard'. */
    source: z.string(),
  })
  .strict()
export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>

/** The write shape — `seq` is assigned by the store, so it is omitted here. */
export const ChangeLogInputSchema = ChangeLogEntrySchema.omit({ seq: true })
export type ChangeLogInput = z.infer<typeof ChangeLogInputSchema>
