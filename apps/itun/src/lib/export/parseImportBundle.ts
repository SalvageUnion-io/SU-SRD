import { isRecord } from '../isRecord'
import { normalizeLegacyCargoRecord } from '../schemas/cargoLot'
import { ExportBundleSchema } from '../schemas/exportBundle'
import type { ExportBundle } from '../schemas/exportBundle'
import { normalizeLegacyPilotRecord } from '../schemas/pilot'
import type { ContainerFields } from '../container'
import { assignContainers } from './legacyContainers'

/**
 * Bundles written before the cargo→cargoLots rename carry mechs (and
 * patterns) with a legacy `cargo: string[]` field, and bundles written before
 * the vestigial `rollResults` removal carry it on pilots. Convert them in
 * place — the same rewrites the v3/v4 IndexedDB migrations apply — so old
 * backups stay importable.
 */
function normalizeLegacyBundle(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const bundle = { ...raw }

  const entities = bundle.entities
  if (isRecord(entities)) {
    const entitiesCopy = { ...entities }
    if (Array.isArray(entitiesCopy.mechs)) {
      entitiesCopy.mechs = (entitiesCopy.mechs as unknown[]).map((m) =>
        isRecord(m) ? normalizeLegacyCargoRecord(m) : m
      )
    }
    if (Array.isArray(entitiesCopy.pilots)) {
      entitiesCopy.pilots = (entitiesCopy.pilots as unknown[]).map((p) =>
        isRecord(p) ? normalizeLegacyPilotRecord(p) : p
      )
    }
    bundle.entities = entitiesCopy
  }

  if (Array.isArray(bundle.mechPatterns)) {
    bundle.mechPatterns = (bundle.mechPatterns as unknown[]).map((p) =>
      isRecord(p) ? normalizeLegacyCargoRecord(p) : p
    )
  }

  return bundle
}

/**
 * parseImportBundle — parse and validate a raw JSON string as an ExportBundle.
 *
 * Throws a descriptive Error when:
 *   - The string is not valid JSON.
 *   - The parsed value does not conform to ExportBundleSchema.
 *   - schemaVersion is not 1 (incompatible format).
 *
 * Legacy compatibility: mechs/patterns carrying the pre-rename
 * `cargo: string[]` field are normalized to `cargoLots` and pilots carrying
 * the removed `rollResults` field have it dropped before validation;
 * bundles without `mechPatterns` or `encounterNpcs` get an empty array
 * (schema default) — both fields were added additively, no schemaVersion
 * bump required.
 *
 * On success returns the validated ExportBundle.
 */
/** Bundle versions this build can read. v1 predates the Game/Shelf split. */
const SUPPORTED_VERSIONS: readonly number[] = [1, 2]
/** What a bundle written today declares. */
const CURRENT_VERSION = 2

export function parseImportBundle(jsonText: string): ExportBundle {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('Import failed: file is not valid JSON.')
  }
  raw = normalizeLegacyBundle(raw)

  // Check schemaVersion early to give a clearer error before full Zod parse.
  //
  // v2 is the post-ADR-030 shape: entities carry `gameId` (a Game, or null for
  // the owner's shelf) instead of `workspaceId`. v1 is still accepted and
  // always will be — a backup taken before accounts existed is exactly the file
  // somebody reaches for when they come back after a year, and refusing it
  // would strand the data this whole migration is supposed to carry forward.
  if (
    isRecord(raw) &&
    'schemaVersion' in raw &&
    !SUPPORTED_VERSIONS.includes(Number(raw.schemaVersion))
  ) {
    throw new Error(
      `Import failed: unsupported schemaVersion "${String(raw.schemaVersion)}". Supported: ${SUPPORTED_VERSIONS.join(', ')}.`
    )
  }

  // A v1 bundle predates containers, so give every entity one on the way in,
  // using the SAME rule migration 13 applies on an existing device. A roster
  // must not land somewhere different depending on how it arrived.
  if (isRecord(raw) && Number(raw.schemaVersion) === 1 && isRecord(raw.entities)) {
    const e = raw.entities as Record<string, unknown>
    for (const kind of ['pilots', 'mechs', 'crawlers'] as const) {
      if (Array.isArray(e[kind])) {
        e[kind] = assignContainers(e[kind] as ContainerFields[])
      }
    }
    // Normalised to the current shape so the rest of the pipeline sees one
    // format rather than branching on version at every step.
    ;(raw as Record<string, unknown>).schemaVersion = CURRENT_VERSION
  }

  const result = ExportBundleSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Import failed: bundle does not match expected schema. ${result.error.message}`)
  }

  return result.data
}
