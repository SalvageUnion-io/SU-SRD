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

import { useState } from 'react'

import type { Pilot } from '../../lib/schemas/pilot'
import type { Mech } from '../../lib/schemas/mech'
import type { Crawler } from '../../lib/schemas/crawler'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { EntityRef } from '../../lib/schemas/entity'

import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../wiring/useSoftLinks'
import type { SoftLinkStore } from '../wiring/useSoftLinks'

import { SheetHeader } from './SheetHeader'
import type { CompositionMode } from './SheetHeader'
import { SheetSegmentSwitcher } from './SheetSegmentSwitcher'
import type { SheetSegment } from './SheetSegmentSwitcher'
import { PilotSheet } from './PilotSheet'
import { MechSheet } from './MechSheet'
import { CrawlerSheet } from './CrawlerSheet'
import { PilotStandIn } from '../shared/PilotStandIn'
import { MechStandIn } from '../shared/MechStandIn'
import { PublishButton } from './PublishButton'
import { sheetAccentFor } from './sheetAccent'

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
  /**
   * When true, the PublishButton is hidden. Use for snapshot-view contexts
   * where publishing is not applicable.
   */
  readOnly?: boolean
}

export function Sheet({
  kind,
  id,
  entityStore: entityStoreOverride,
  softLinkStore,
  readOnly = false,
}: SheetProps) {
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

  // Mobile-only segment switcher state (#255). `null` means "default to the
  // first present segment" — resolved once segments are known below, so the
  // initial render shows the sheet's own kind without an effect.
  const [activeSegment, setActiveSegment] = useState<SheetSegment | null>(null)

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
      <main className="mx-auto max-w-7xl p-3 sm:p-6">
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
  // Determine if wired composition warrants a 2-pane layout at lg+.
  // Only activate 2-pane when the left pane has content (pilot present).
  // kind=crawler wired (crawler with assigned pilots) has pilot=null/mech=null,
  // so the left pane would be empty — render single-column in that case.
  const isWired = resolved.mode === 'wired' && resolved.pilot !== null

  // ---------------------------------------------------------------------------
  // Mobile segment switcher (#255)
  // Only surface segments for entities that actually exist on the sheet. The
  // pilot/mech stand-ins (shown for the sheet's own kind when its counterpart
  // is missing) ride along with the pilot/mech segments rather than getting
  // their own tab, so a pilot-only sheet shows just "Pilot".
  //
  // Sections are mounted exactly once and toggled per-viewport via Tailwind
  // visibility classes: below `lg` only the active segment is shown; at `lg+`
  // every present section is shown and the original two-pane / single-column
  // layout is restored untouched. `mobileVis()` builds the per-section class.
  // ---------------------------------------------------------------------------
  const segments: SheetSegment[] = [
    ...(resolved.pilot || (kind === 'pilot' && resolved.mode !== 'wired')
      ? (['pilot'] as const)
      : []),
    ...(resolved.mech || resolved.mode === 'mech-only' ? (['mech'] as const) : []),
    ...(resolved.crawler ? (['crawler'] as const) : []),
  ]
  const fallbackSegment: SheetSegment =
    kind === 'pilot' ? 'pilot' : kind === 'mech' ? 'mech' : 'crawler'
  const resolvedActive: SheetSegment =
    activeSegment && segments.includes(activeSegment)
      ? activeSegment
      : segments.includes(fallbackSegment)
        ? fallbackSegment
        : (segments[0] ?? fallbackSegment)

  // Per-section mobile visibility: shown below lg only when it is the active
  // segment; always shown (flex-flow) at lg+.
  const mobileVis = (segment: SheetSegment) =>
    cn(resolvedActive === segment ? 'block' : 'hidden', 'lg:block')

  const pilotSection = resolved.pilot ? (
    <PilotSheet pilot={resolved.pilot} readOnly={readOnly} />
  ) : null
  const mechSection = resolved.mech ? <MechSheet mech={resolved.mech} readOnly={readOnly} /> : null
  const crawlerSection = resolved.crawler ? (
    <CrawlerSheet crawler={resolved.crawler} pilots={resolved.crawlerPilots} readOnly={readOnly} />
  ) : null

  // Stand-ins shown for the sheet's own kind when a counterpart is missing.
  const showMechStandIn = kind === 'pilot' && !resolved.mech
  const showPilotStandIn = resolved.mode === 'mech-only'

  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-6">
      <SheetHeader name={displayName} mode={resolved.mode} accent={sheetAccentFor(kind)} />
      {!readOnly && (
        <div className="flex justify-end mb-4">
          <PublishButton entityKind={kind} entityId={id} entityStore={entityStoreOverride} />
        </div>
      )}

      {/* Mobile-only segmented switcher (< lg). Hidden when only one segment. */}
      {segments.length > 1 && (
        <SheetSegmentSwitcher
          segments={segments}
          active={resolvedActive}
          onChange={setActiveSegment}
          className="sticky top-0 z-10 -mx-3 mb-6 bg-su-paper px-3 py-2 lg:hidden"
        />
      )}

      {isWired ? (
        /* Wired composition: single mobile column; 2-pane at lg+ */
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
          {/* Left pane (pilot + mech). `contents` on mobile so its children
              flow into the outer column; restored to a pane at lg+. */}
          <div className="contents lg:flex lg:flex-col lg:gap-8 lg:flex-1 lg:min-w-0">
            {pilotSection && <div className={mobileVis('pilot')}>{pilotSection}</div>}
            {mechSection && <div className={mobileVis('mech')}>{mechSection}</div>}
            {showMechStandIn && (
              <div className={mobileVis('pilot')}>
                <MechStandIn />
              </div>
            )}
          </div>
          {/* Right pane: crawler */}
          {crawlerSection && (
            <div className={cn(mobileVis('crawler'), 'lg:w-80 lg:shrink-0')}>{crawlerSection}</div>
          )}
        </div>
      ) : (
        /* Single-entity / non-2-pane: single column at all sizes */
        <div className="flex flex-col gap-8">
          {pilotSection && <div className={mobileVis('pilot')}>{pilotSection}</div>}

          {/* Pilot stand-in: shown in mech-only mode (no wired pilot) */}
          {showPilotStandIn && (
            <div className={mobileVis('mech')}>
              <PilotStandIn />
            </div>
          )}

          {mechSection && <div className={mobileVis('mech')}>{mechSection}</div>}

          {/* Mech stand-in: shown in pilot-only mode (no mech) */}
          {showMechStandIn && (
            <div className={mobileVis('pilot')}>
              <MechStandIn />
            </div>
          )}

          {/* Crawler section — pilots=[] triggers the stand-in in crawler-only mode */}
          {crawlerSection && <div className={mobileVis('crawler')}>{crawlerSection}</div>}
        </div>
      )}
    </main>
  )
}
