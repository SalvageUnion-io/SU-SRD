/**
 * SnapshotView — renders a published snapshot payload as a read-only sheet
 * on the rebuilt Header C shell (plan 4.8).
 *
 * Store-free: the frozen snapshot entity is wrapped in a private read-only
 * Zustand store (writes throw; they are unreachable because every edit
 * affordance is suppressed by `readOnly`) and threaded into the same Sheet /
 * composition-resolver path the live sheets use. The app's entityStore,
 * SoftLinks and IndexedDB are never touched, so the /s/$id route renders
 * fully independent of local state. With no SoftLinks the resolver yields
 * the single-entity mode — no rail chips to other people's data.
 *
 * Snapshot payload shape (as published by PublishButton v1):
 *   { kind: 'pilot' | 'mech' | 'crawler', entity: <entity object> }
 *
 * Payloads are Zod-validated; a graceful error state renders on mismatch.
 */

import { useMemo } from 'react'
import { create } from 'zustand'

import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { MechSchema } from '../../lib/schemas/mech'
import { PilotSchema, normalizeLegacyPilotRecord } from '../../lib/schemas/pilot'
import { normalizeLegacyCargoRecord } from '../../lib/schemas/cargoLot'
import { useEntityStore } from '../../stores/entityStore'
import type { EntityType } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'

import { Sheet } from './Sheet'

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
    // Snapshots published before the vestigial `rollResults` removal still
    // carry the field — same rewrite parseImportBundle applies.
    const parsed = PilotSchema.safeParse(
      normalizeLegacyPilotRecord(entity as Record<string, unknown>)
    )
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

type EntityState = ReturnType<typeof useEntityStore.getState>

/**
 * A read-only entity store containing ONLY the snapshot entity. Reads serve
 * the frozen record; writes throw (unreachable behind `readOnly`).
 */
function makeSnapshotStore(parsed: Extract<ParseResult, { ok: true }>): typeof useEntityStore {
  const readOnlyWrite = async (): Promise<never> => {
    throw new Error('Snapshots are read-only.')
  }

  const byType = (type: EntityType): Array<Pilot | Mech | Crawler> => {
    if (type === parsed.kind) return [parsed.entity]
    return []
  }

  const state: EntityState = {
    pilots: parsed.kind === 'pilot' ? [parsed.entity] : [],
    mechs: parsed.kind === 'mech' ? [parsed.entity] : [],
    crawlers: parsed.kind === 'crawler' ? [parsed.entity] : [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
    hydrate: async () => {},
    rehydrate: async () => {},
    list: ((type: EntityType) => byType(type)) as EntityState['list'],
    get: ((type: EntityType, id: string) =>
      byType(type).find((e) => e.id === id) ?? null) as EntityState['get'],
    create: readOnlyWrite,
    update: readOnlyWrite,
    updateCrawlerBay: readOnlyWrite,
    delete: readOnlyWrite,
    transfer: readOnlyWrite,
  }

  return create<EntityState>(() => state)
}

export function SnapshotView({ snapshot }: SnapshotViewProps) {
  const result = useMemo(() => parseSnapshot(snapshot), [snapshot])
  const store = useMemo(() => (result.ok ? makeSnapshotStore(result) : null), [result])

  if (!result.ok || !store) {
    // Styled validation-failure state (plan 5.2) — invalid payloads land
    // here, never in a crash: the Zod parse above is the only consumer of
    // the untrusted payload.
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Could not render snapshot</h1>
        <p className="text-wk-muted mb-1 text-sm">
          This snapshot&rsquo;s data doesn&rsquo;t match any build this app knows how to show. It
          may have been published by a newer or older version.
        </p>
        {!result.ok && (
          <p className="text-wk-muted mb-4 break-words font-mono text-xs">{result.reason}</p>
        )}
        <AppLink href="/" className="text-sm underline">
          &larr; Back to dashboard
        </AppLink>
      </main>
    )
  }

  return (
    <div>
      {/* Snapshot banner — makes read-only context clear */}
      <div
        role="note"
        aria-label="Read-only snapshot"
        className="border-b-2 border-ink bg-su-sickly-yellow px-4 py-2 font-body text-sm font-semibold text-ink sm:px-[30px]"
      >
        This is a read-only snapshot. Changes made in-game are not reflected here.
      </div>

      <Sheet kind={result.kind} id={result.entity.id} store={store} readOnly />
    </div>
  )
}
