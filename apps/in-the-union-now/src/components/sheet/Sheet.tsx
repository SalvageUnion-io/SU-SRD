/**
 * Sheet — root live-sheet component on the Header C LiveSheet shell (plan
 * 4.1–4.3). Resolves the entity + its SoftLink composition (the ported
 * resolver in composition.ts), then dispatches to ONE per-kind view
 * (SheetPilotView / SheetMechView / SheetCrawlerView — audit item 19):
 * hero = entity-card-writ-large with live trackers, linked entities as rail
 * chips (live mini stats, whole-chip navigation), variant sheet as the body.
 *
 * This replaces the old multi-pane composition layout (SheetHeader +
 * SheetSegmentSwitcher + stand-ins): linked entities are no longer
 * co-rendered as full sheets — they live in the rail and navigate.
 *
 * Stats are store-backed: hero trackers write current* fields through the
 * entity store; the condensed strip reads the same record, so hero and strip
 * stay in lockstep (§4.1). Sheet keeps the (deliberately broad) store
 * subscription — composition is cross-type, every linked record renders
 * live — and hands the views resolved data via props.
 */

import { btnVariants } from 'suref-react'

import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import type { SoftLinkStore } from '../wiring/useSoftLinks'

import { resolveSheetComposition } from './composition'
import type { EntityLookup } from './composition'
import type { LiveSheetSegment } from './LiveSheet'
import { PublishButton } from './PublishButton'
import { SheetActionsMenu } from './SheetActionsMenu'
import { SheetCrawlerView } from './SheetCrawlerView'
import { SheetMechView } from './SheetMechView'
import { SheetPilotView } from './SheetPilotView'

// Re-exported so existing consumers (PublishButton, tests) keep their import.
export type { EntityLookup } from './composition'

type SheetProps = {
  kind: EntityRef['type']
  id: string
  /** Injectable entity lookup for testing; the live store when omitted. */
  entityStore?: EntityLookup
  /** Injectable soft-link snapshot for testing; the live store when omitted. */
  softLinkStore?: SoftLinkStore
  /** Injectable store hook (writes); the real Zustand store when omitted. */
  store?: typeof useEntityStore
  /** Hides publish + disables all stat editing (snapshot contexts). */
  readOnly?: boolean
}

export function Sheet({
  kind,
  id,
  entityStore,
  softLinkStore,
  store = useEntityStore,
  readOnly = false,
}: SheetProps) {
  const storeState = store()

  const lookup: EntityLookup =
    entityStore ??
    ({
      get: (type, entityId) => storeState.get(type, entityId),
    } as EntityLookup)
  const links = softLinkStore ? softLinkStore.softLinks : storeState.softLinks

  const composition = resolveSheetComposition({
    kind,
    id,
    links,
    store: lookup,
  })
  const entity = lookup.get(kind, id)

  if (!entity) {
    // Styled not-found with an exit path — this is the most-visited surface
    // in the app; a bare one-liner stranded the user (audit item 7).
    return (
      <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
        <div className="flex w-full max-w-xl flex-col items-start gap-4 rounded-[6px] border-chrome border-ink bg-paper p-6 sm:p-8">
          <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
            {kind} not found
          </h1>
          <p className="font-body text-sm text-wk-muted">
            This {kind} may have been deleted, or the link may be stale.
          </p>
          <AppLink
            href="/"
            className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
          >
            &larr; Back to dashboard
          </AppLink>
        </div>
      </main>
    )
  }

  const wired = composition.mode === 'wired'
  const back = { href: '/', label: 'Dashboard' }
  // Top-bar trailing actions (§1.3): Edit as a sm ghost btn linking the
  // entity's edit wizard route, then Share (publish). Below the sm endpoint
  // both fold into a "⋯" overflow menu (design review U-5) so the condensed
  // bar keeps its width for the priority MiniStats; the menu items mount only
  // while open, so the inline copies stay the unique Edit/Share in the DOM.
  const editLink = (
    <AppLink
      href={`/${kind}s/${id}/edit`}
      aria-label={`Edit this ${kind}`}
      className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
    >
      Edit
    </AppLink>
  )
  // Print/PDF export (#82/#258): the print stylesheet (index.css @media
  // print) turns the live sheet into a clean paper layout; "Save as PDF"
  // in the browser dialog covers the PDF ask without a rendering dep.
  const printButton = (
    <button
      type="button"
      aria-label={`Print this ${kind} sheet`}
      onClick={() => window.print()}
      className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'cursor-pointer')}
    >
      Print
    </button>
  )
  const actions = !readOnly ? (
    <>
      <div className="hidden items-center gap-2.5 sm:flex">
        {editLink}
        {printButton}
        <PublishButton entityKind={kind} entityId={id} entityStore={entityStore} />
      </div>
      <SheetActionsMenu className="sm:hidden">
        {editLink}
        {printButton}
        <PublishButton entityKind={kind} entityId={id} entityStore={entityStore} />
      </SheetActionsMenu>
    </>
  ) : undefined

  // Mobile segmented Pilot/Mech/Crawler switch (design §3.7) — wired sheets
  // only; each present counterpart gets a segment, the viewed kind is active.
  let segments: LiveSheetSegment[] | undefined
  if (wired) {
    segments = []
    if (composition.pilot) {
      segments.push({
        key: 'pilot',
        label: 'Pilot',
        href: `/sheet/pilot/${composition.pilot.id}`,
        active: kind === 'pilot',
      })
    }
    if (composition.mech) {
      segments.push({
        key: 'mech',
        label: 'Mech',
        href: `/sheet/mech/${composition.mech.id}`,
        active: kind === 'mech',
      })
    }
    if (composition.crawler) {
      segments.push({
        key: 'crawler',
        label: 'Crawler',
        href: `/sheet/crawler/${composition.crawler.id}`,
        active: kind === 'crawler',
      })
    }
  }

  /** Persist a partial patch on the sheet's own entity (fire-and-forget). */
  function patch(fields: Partial<Pilot> & Partial<Mech> & Partial<Crawler>) {
    void storeState.update(kind, id, fields)
  }

  const common = {
    composition,
    wired,
    back,
    actions,
    segments,
    editable: !readOnly,
    readOnly,
    store,
    storeState,
    lookup,
    patch,
  }

  if (kind === 'pilot') {
    return <SheetPilotView pilot={entity as Pilot} {...common} />
  }
  if (kind === 'mech') {
    return <SheetMechView mech={entity as Mech} {...common} />
  }
  return <SheetCrawlerView crawler={entity as Crawler} {...common} />
}
