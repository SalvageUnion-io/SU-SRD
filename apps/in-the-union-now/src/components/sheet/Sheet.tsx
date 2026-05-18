/**
 * Sheet — root sheet component. Resolves composition mode from SoftLinks,
 * then renders the appropriate section components.
 *
 * Composition mode algorithm:
 *
 *   kind=mech  + mech-to-pilot outgoing → wired (mech+pilot)
 *   kind=mech  + no links               → mech-only
 *   kind=pilot + mech-to-pilot incoming + pilot-to-crawler outgoing
 *                                       → wired (full: mech+pilot+crawler)
 *   kind=pilot + mech-to-pilot incoming only → wired (mech+pilot)
 *   kind=pilot + pilot-to-crawler outgoing only → wired (pilot+crawler)
 *   kind=pilot + no links               → pilot-only
 *   kind=crawler + pilot-to-crawler incoming → wired (crawler+pilots)
 *   kind=crawler + no links             → crawler-only
 *
 * All state is read from dep-injectable stores. In production, `entityStore`
 * and `softLinkStore` default to the real Zustand store. In tests, pass a
 * snapshot of the store state directly.
 */

import type { Pilot } from '../../lib/schemas/pilot'
import type { Mech } from '../../lib/schemas/mech'
import type { Crawler } from '../../lib/schemas/crawler'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { EntityRef } from '../../lib/schemas/entity'

import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../wiring/useSoftLinks'
import type { SoftLinkStore } from '../wiring/useSoftLinks'

import { SheetHeader } from './SheetHeader'
import type { CompositionMode } from './SheetHeader'
import { PilotSheet } from './PilotSheet'
import { MechSheet } from './MechSheet'
import { CrawlerSheet } from './CrawlerSheet'
import { PilotStandIn } from '../shared/PilotStandIn'

// ---------------------------------------------------------------------------
// Dep-injection types for testing
// ---------------------------------------------------------------------------

export type EntityLookup = {
  get: <T extends EntityRef['type']>(
    type: T,
    id: string
  ) => (T extends 'pilot' ? Pilot : T extends 'mech' ? Mech : Crawler) | null
}

type SheetProps = {
  kind: EntityRef['type']
  id: string
  /**
   * Injectable entity store for testing. When omitted, uses the real
   * Zustand useEntityStore.
   */
  entityStore?: EntityLookup
  /**
   * Injectable soft-link store for testing. Passed through to useSoftLinks.
   * When omitted, useSoftLinks reads from the real Zustand store.
   */
  softLinkStore?: SoftLinkStore
}

export function Sheet({ kind, id, entityStore: entityStoreOverride, softLinkStore }: SheetProps) {
  // ---------------------------------------------------------------------------
  // Always call hooks (Rules of Hooks) — real store used when no override.
  // ---------------------------------------------------------------------------
  const realStore = useEntityStore()
  const store: EntityLookup = entityStoreOverride ?? {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (type, entityId) => realStore.get(type as any, entityId) as any,
  }

  const { outgoing, incoming } = useSoftLinks({
    entityType: kind,
    entityId: id,
    store: softLinkStore,
  })

  // ---------------------------------------------------------------------------
  // Resolve main entity
  // ---------------------------------------------------------------------------
  const entity =
    kind === 'pilot'
      ? (store.get('pilot', id) as Pilot | null)
      : kind === 'mech'
        ? (store.get('mech', id) as Mech | null)
        : (store.get('crawler', id) as Crawler | null)

  // ---------------------------------------------------------------------------
  // Composition mode + related entity resolution
  // ---------------------------------------------------------------------------
  type Resolved = {
    mode: CompositionMode
    pilot: Pilot | null
    mech: Mech | null
    crawler: Crawler | null
    crawlerPilots: Pilot[]
  }

  const resolved = ((): Resolved => {
    if (kind === 'mech') {
      const mechToPilotLink = outgoing.find((l: SoftLink) => l.type === 'mech-to-pilot')
      if (mechToPilotLink) {
        const pilot = store.get('pilot', mechToPilotLink.to.id) as Pilot | null
        return {
          mode: 'wired',
          pilot,
          mech: entity as Mech | null,
          crawler: null,
          crawlerPilots: [],
        }
      }
      return {
        mode: 'mech-only',
        pilot: null,
        mech: entity as Mech | null,
        crawler: null,
        crawlerPilots: [],
      }
    }

    if (kind === 'pilot') {
      const mechLink = incoming.find((l: SoftLink) => l.type === 'mech-to-pilot')
      const crawlerLink = outgoing.find((l: SoftLink) => l.type === 'pilot-to-crawler')

      if (mechLink && crawlerLink) {
        const mech = store.get('mech', mechLink.from.id) as Mech | null
        const crawler = store.get('crawler', crawlerLink.to.id) as Crawler | null
        return { mode: 'wired', pilot: entity as Pilot | null, mech, crawler, crawlerPilots: [] }
      }
      if (mechLink) {
        const mech = store.get('mech', mechLink.from.id) as Mech | null
        return {
          mode: 'wired',
          pilot: entity as Pilot | null,
          mech,
          crawler: null,
          crawlerPilots: [],
        }
      }
      if (crawlerLink) {
        const crawler = store.get('crawler', crawlerLink.to.id) as Crawler | null
        return {
          mode: 'wired',
          pilot: entity as Pilot | null,
          mech: null,
          crawler,
          crawlerPilots: [],
        }
      }
      return {
        mode: 'pilot-only',
        pilot: entity as Pilot | null,
        mech: null,
        crawler: null,
        crawlerPilots: [],
      }
    }

    // kind === 'crawler'
    const pilotLinks = incoming.filter((l: SoftLink) => l.type === 'pilot-to-crawler')
    if (pilotLinks.length > 0) {
      const crawlerPilots = pilotLinks
        .map((l: SoftLink) => store.get('pilot', l.from.id) as Pilot | null)
        .filter((p): p is Pilot => p !== null)
      return {
        mode: 'wired',
        pilot: null,
        mech: null,
        crawler: entity as Crawler | null,
        crawlerPilots,
      }
    }
    return {
      mode: 'crawler-only',
      pilot: null,
      mech: null,
      crawler: entity as Crawler | null,
      crawlerPilots: [],
    }
  })()

  // ---------------------------------------------------------------------------
  // Missing entity guard
  // ---------------------------------------------------------------------------
  if (!entity) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground text-sm">Entity not found.</p>
      </main>
    )
  }

  const displayName =
    kind === 'pilot'
      ? (entity as Pilot).name
      : kind === 'mech'
        ? (entity as Mech).name
        : (entity as Crawler).name

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <main className="mx-auto max-w-3xl p-6">
      <SheetHeader name={displayName} mode={resolved.mode} />

      <div className="flex flex-col gap-8">
        {/* Pilot section */}
        {resolved.pilot && <PilotSheet pilot={resolved.pilot} />}

        {/* Pilot stand-in: shown in mech-only mode (no wired pilot) */}
        {resolved.mode === 'mech-only' && <PilotStandIn />}

        {/* Mech section */}
        {resolved.mech && <MechSheet mech={resolved.mech} />}

        {/* Crawler section — pilots=[] triggers the stand-in in crawler-only mode */}
        {resolved.crawler && (
          <CrawlerSheet crawler={resolved.crawler} pilots={resolved.crawlerPilots} />
        )}
      </div>
    </main>
  )
}
