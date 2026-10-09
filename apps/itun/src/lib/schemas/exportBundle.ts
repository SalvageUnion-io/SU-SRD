import { z } from 'salvageunion-reference/zod'
import { CrawlerSchema } from './crawler'
import { EncounterNpcSchema } from './encounterNpc'
import { MechSchema } from './mech'
import { MechPatternSchema } from './pattern'
import { PilotSchema } from './pilot'
import { SoftLinkSchema } from './softLink'

/**
 * ExportBundle — the envelope written to disk during a full backup or
 * single-entity export. schemaVersion 2 is the only format: entities carry
 * `gameId` (a Game, or null for the owner's shelf). parseImportBundle()
 * rejects any other version.
 *
 * Entity scope:
 *   - Full backup (buildExportBundle): all pilots, mechs, crawlers,
 *     softLinks, mechPatterns, and encounterNpcs currently in the store.
 *   - Single-entity export (buildEntityExport): the entity itself plus any
 *     softLinks whose `from` or `to` ref points to that entity id.
 *
 * Versioning: new top-level entity arrays (mechPatterns, encounterNpcs) are
 * added with `.default([])` rather than bumping schemaVersion. This is
 * additive-safe: a bundle without the field gets the default on parse, and an
 * app build that doesn't know a field ignores it rather than choking on it. A
 * version bump is reserved for BREAKING shape changes (renames,
 * removed/narrowed fields).
 */
export const ExportBundleSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.string(),
  entities: z.object({
    pilots: z.array(PilotSchema),
    mechs: z.array(MechSchema),
    crawlers: z.array(CrawlerSchema),
  }),
  softLinks: z.array(SoftLinkSchema),
  /**
   * Saved mech patterns (gap 6: export is the ONLY backup path for work that is
   * not in an account — omitting patterns silently loses them). Defaulted so bundles
   * written before this field existed still import.
   */
  mechPatterns: z.array(MechPatternSchema).default([]),
  /**
   * GM encounter-tray NPC instances (durability audit finding: encounterNpcs
   * had NO representation in ExportBundleSchema at all, so a full backup
   * silently dropped GM tray state). Defaulted so bundles written before this
   * field existed still import cleanly.
   */
  encounterNpcs: z.array(EncounterNpcSchema).default([]),
})

export type ExportBundle = z.infer<typeof ExportBundleSchema>
