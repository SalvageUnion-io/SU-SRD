import { z } from 'salvageunion-reference/zod'
import { CrawlerSchema } from './crawler'
import { EncounterNpcSchema } from './encounterNpc'
import { MechSchema } from './mech'
import { MechPatternSchema } from './pattern'
import { PilotSchema } from './pilot'
import { SoftLinkSchema } from './softLink'

/**
 * ExportBundle — the envelope written to disk during a full backup or
 * single-entity export. schemaVersion: 1 is the current and only supported
 * version; parseImportBundle() rejects any other value.
 *
 * Entity scope:
 *   - Full backup (buildExportBundle): all pilots, mechs, crawlers,
 *     softLinks, mechPatterns, and encounterNpcs currently in the store.
 *   - Single-entity export (buildEntityExport): the entity itself plus any
 *     softLinks whose `from` or `to` ref points to that entity id. Workspaces
 *     are NOT included in a single-entity export — the importing side will have
 *     its own workspaces, and the remapping step in mergeImport handles
 *     workspaceId by dropping links to missing workspaces gracefully.
 *
 * Versioning: new top-level entity arrays (mechPatterns, encounterNpcs) are
 * added with `.default([])` rather than bumping schemaVersion. This is
 * additive-safe: old bundles simply lack the field and the default fills it
 * in on parse (parseImportBundle), and old app builds that don't know a
 * field ignore it rather than choking on it. A version bump is reserved for
 * BREAKING shape changes (renames, removed/narrowed fields) — see the
 * `cargo` → `cargoLots` rewrite in parseImportBundle's `normalizeLegacyBundle`
 * for how those are handled without a version bump either, by normalizing
 * the raw shape before validation.
 */
export const ExportBundleSchema = z.object({
  /**
   * 1 = pre-ADR-030 (entities carry `workspaceId`); 2 = containers
   * (`gameId`, null meaning the owner's shelf). `parseImportBundle` upgrades a
   * v1 payload to v2 before validation, so anything reaching this schema is
   * already normalised — but both are accepted so a hand-edited or
   * partially-processed bundle still parses rather than failing opaquely.
   */
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  entities: z.object({
    pilots: z.array(PilotSchema),
    mechs: z.array(MechSchema),
    crawlers: z.array(CrawlerSchema),
  }),
  /**
   * @deprecated Workspaces are retired (ADR-030 §2). Kept in the schema, and
   * kept permissive, purely so a bundle written before they were removed still
   * imports — the array is read by nothing. Dropping the key outright would
   * turn every existing backup into a parse error, which is the one thing an
   * export format must never do.
   */
  workspaces: z.array(z.unknown()).default([]),
  softLinks: z.array(SoftLinkSchema),
  /**
   * Saved mech patterns (gap 6: export is the ONLY backup path for local-first
   * data — omitting patterns silently loses them). Defaulted so bundles
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
