/**
 * SnapshotView — renders a published snapshot payload as a read-only sheet.
 *
 * This component intentionally does NOT use entityStore or SoftLinks — it
 * renders the frozen snapshot data directly. This avoids a dependency on
 * cycle-1's click-to-edit changes and makes the read-only snapshot route
 * fully independent of local store state.
 *
 * Snapshot payload shape (as published by PublishButton v1):
 *   { kind: 'pilot' | 'mech' | 'crawler', entity: <entity object> }
 *
 * If the payload doesn't match the expected shape, a graceful error state
 * is rendered.
 */

import { PilotSheet } from './PilotSheet'
import { MechSheet } from './MechSheet'
import { CrawlerSheet } from './CrawlerSheet'
import { SheetHeader } from './SheetHeader'
import type { CompositionMode } from './SheetHeader'
import type { Pilot } from '../../lib/schemas/pilot'
import type { Mech } from '../../lib/schemas/mech'
import type { Crawler } from '../../lib/schemas/crawler'
import { PilotSchema } from '../../lib/schemas/pilot'
import { MechSchema } from '../../lib/schemas/mech'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { normalizeLegacyCargoRecord } from '../../lib/schemas/cargoLot'

type SnapshotViewProps = {
  /** The raw payload returned by retrieveSnapshot — not yet validated. */
  snapshot: Record<string, unknown>
}

type ParseResult =
  | { ok: true; kind: 'pilot'; entity: Pilot }
  | { ok: true; kind: 'mech'; entity: Mech }
  | { ok: true; kind: 'crawler'; entity: Crawler }
  | { ok: false; reason: string }

function parseSnapshot(snapshot: Record<string, unknown>): ParseResult {
  const kind = snapshot['kind']
  const entity = snapshot['entity']

  if (entity === null || typeof entity !== 'object' || Array.isArray(entity)) {
    return { ok: false, reason: 'Snapshot entity is missing or invalid.' }
  }

  if (kind === 'pilot') {
    const parsed = PilotSchema.safeParse(entity)
    if (!parsed.success) {
      return {
        ok: false,
        reason: `Invalid pilot data: ${parsed.error.message}`,
      }
    }
    return { ok: true, kind: 'pilot', entity: parsed.data }
  }

  if (kind === 'mech') {
    // Snapshots published before the cargo→cargoLots rename carry a legacy
    // `cargo: string[]` field — same rewrite parseImportBundle applies.
    const parsed = MechSchema.safeParse(
      normalizeLegacyCargoRecord(entity as Record<string, unknown>)
    )
    if (!parsed.success) {
      return {
        ok: false,
        reason: `Invalid mech data: ${parsed.error.message}`,
      }
    }
    return { ok: true, kind: 'mech', entity: parsed.data }
  }

  if (kind === 'crawler') {
    const parsed = CrawlerSchema.safeParse(entity)
    if (!parsed.success) {
      return {
        ok: false,
        reason: `Invalid crawler data: ${parsed.error.message}`,
      }
    }
    return { ok: true, kind: 'crawler', entity: parsed.data }
  }

  return { ok: false, reason: `Unknown entity kind: ${String(kind)}` }
}

function kindToMode(kind: 'pilot' | 'mech' | 'crawler'): CompositionMode {
  switch (kind) {
    case 'pilot':
      return 'pilot-only'
    case 'mech':
      return 'mech-only'
    case 'crawler':
      return 'crawler-only'
  }
}

export function SnapshotView({ snapshot }: SnapshotViewProps) {
  const result = parseSnapshot(snapshot)

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-muted-foreground">Could not render snapshot: {result.reason}</p>
      </main>
    )
  }

  const mode = kindToMode(result.kind)
  const name = result.entity.name

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Snapshot banner — makes read-only context clear */}
      <div
        role="note"
        aria-label="Read-only snapshot"
        className="mb-4 rounded-sm border border-su-black bg-su-sickly-yellow px-3 py-2 text-sm font-semibold text-su-black"
      >
        This is a read-only snapshot. Changes made in-game are not reflected here.
      </div>

      <SheetHeader name={name} mode={mode} />

      <div className="flex flex-col gap-8">
        {result.kind === 'pilot' && <PilotSheet pilot={result.entity} readOnly />}
        {result.kind === 'mech' && <MechSheet mech={result.entity} readOnly />}
        {result.kind === 'crawler' && <CrawlerSheet crawler={result.entity} pilots={[]} readOnly />}
      </div>
    </main>
  )
}
