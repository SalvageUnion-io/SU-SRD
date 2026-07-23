import { z } from 'salvageunion-reference/zod'

/**
 * CockpitPrefs — persisted Play Cockpit ("Pit HUD") dial preferences
 * (docs/architecture/play-cockpit.md §9.7).
 *
 * These are PERSISTED (unlike the ephemeral mount/wheel state in
 * playStateStore): which dial items the player has hidden and the order they
 * ride the rotary Dial. They are stored on the owning Workspace record
 * (local-first, IndexedDB — no backend), so a table's cockpit remembers its
 * dial layout across sessions.
 *
 * Prefs key the STABLE dial "kind" (actions / mech / pilot / crawler / tables /
 * srd), never a per-instance dial key like `mech:<uuid>` — the entity ids vary
 * per cockpit, but the kinds are stable, so the same prefs apply regardless of
 * which mech/pilot/crawler is loaded. `actions` is always visible (locked in the
 * UI); it is never added to `hidden`, and the apply step ignores it if it were.
 */

export const DialKindSchema = z.enum(['actions', 'mech', 'pilot', 'crawler', 'tables', 'srd'])
export type DialKind = z.infer<typeof DialKindSchema>

export const CockpitPrefsSchema = z
  .object({
    /** Dial kinds the player has hidden. `actions` is never hidden. */
    hidden: z.array(DialKindSchema).default([]),
    /** Dial kinds in the player's chosen order; unlisted kinds keep default order. */
    order: z.array(DialKindSchema).default([]),
  })
  .strict()

export type CockpitPrefs = z.infer<typeof CockpitPrefsSchema>
