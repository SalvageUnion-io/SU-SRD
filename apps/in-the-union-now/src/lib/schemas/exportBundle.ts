import { z } from 'zod'

import { CrawlerSchema } from './crawler'
import { MechSchema } from './mech'
import { PilotSchema } from './pilot'
import { SoftLinkSchema } from './softLink'
import { WorkspaceSchema } from './workspace'

/**
 * ExportBundle — the envelope written to disk during a full backup or
 * single-entity export. schemaVersion: 1 is the current and only supported
 * version; parseImportBundle() rejects any other value.
 *
 * Entity scope:
 *   - Full backup (buildExportBundle): all pilots, mechs, crawlers, workspaces,
 *     and softLinks currently in the store.
 *   - Single-entity export (buildEntityExport): the entity itself plus any
 *     softLinks whose `from` or `to` ref points to that entity id. Workspaces
 *     are NOT included in a single-entity export — the importing side will have
 *     its own workspaces, and the remapping step in mergeImport handles
 *     workspaceId by dropping links to missing workspaces gracefully.
 */
export const ExportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  entities: z.object({
    pilots: z.array(PilotSchema),
    mechs: z.array(MechSchema),
    crawlers: z.array(CrawlerSchema),
  }),
  workspaces: z.array(WorkspaceSchema),
  softLinks: z.array(SoftLinkSchema),
})

export type ExportBundle = z.infer<typeof ExportBundleSchema>
