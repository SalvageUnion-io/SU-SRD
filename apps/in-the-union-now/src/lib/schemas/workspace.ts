import { z } from 'salvageunion-reference/zod'

import { CockpitPrefsSchema } from './cockpitPrefs'

/**
 * A Workspace groups related entities (pilots, mechs, crawlers) for a
 * single campaign or play session. It has no game-data references of its own.
 *
 * `cockpitPrefs` is a purely additive-optional field (Play Cockpit Phase 7):
 * persisted dial show/hide + order prefs for this table's cockpit. Optional
 * fields need NO migration — strict Zod parsing tolerates the missing key on
 * records written before it existed (see src/lib/db/migrations/README.md).
 */
export const WorkspaceSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    createdAt: z.string().datetime(),
    /** Play Cockpit dial preferences (show/hide + order). Absent on older records. */
    cockpitPrefs: CockpitPrefsSchema.optional(),
  })
  .strict()

export type Workspace = z.infer<typeof WorkspaceSchema>
