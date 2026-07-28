/**
 * Sheet — root live-sheet component on the Header C LiveSheet shell (plan
 * 4.1–4.3). Resolves the entity + its SoftLink composition (the ported
 * resolver in composition.ts), then dispatches to ONE per-kind view
 * (SheetPilot / SheetMech / SheetCrawler — audit item 19):
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

import { useState } from 'react'
import { buttonVariants } from 'component-lib'

import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import { ExportEntityButton } from '../export/ExportEntityButton'
import { AppLink } from '../shared/AppLink'
import type { SoftLinkStore } from '../wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../workspace/AssignToWorkspaceButton'

import { ChangeLogDrawer } from './ChangeLogDrawer'
import { resolveSheetComposition } from './composition'
import type { EntityLookup } from './composition'
import type { LiveSheetSegment } from './LiveSheet'
import { SheetActionsMenu } from 'component-lib'
import { SheetCrawler } from './SheetCrawler'
import { SheetMech } from './SheetMech'
import { SheetPilot } from './SheetPilot'
import type { SheetPatch } from './sheetViewProps'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'

// Re-exported so existing consumers (PublishButton, tests) keep their import.
export type { EntityLookup } from './composition'

/**
 * The sheet's own entity, resolved with its kind as a discriminant so the
 * per-kind dispatch below narrows without casts.
 */
type ResolvedSheetEntity =
  | { kind: 'pilot'; entity: Pilot }
  | { kind: 'mech'; entity: Mech }
  | { kind: 'crawler'; entity: Crawler }

function resolveSheetEntity(
  lookup: EntityLookup,
  kind: EntityRef['type'],
  id: string
): ResolvedSheetEntity | null {
  switch (kind) {
    case 'pilot': {
      const entity = lookup.get(kind, id)
      return entity === null ? null : { kind, entity }
    }
    case 'mech': {
      const entity = lookup.get(kind, id)
      return entity === null ? null : { kind, entity }
    }
    case 'crawler': {
      const entity = lookup.get(kind, id)
      return entity === null ? null : { kind, entity }
    }
  }
}

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
  /**
   * Pilot ability refs to use instead of the composition's.
   *
   * A published snapshot shares a LIVE INSTANCE but carries a private read-only
   * store with no pilot record and no soft-links, so the composition resolves
   * `pilot: null` — and pilot-sourced contributions (Beefcake's +3+X Max SP and
   * +6 Cargo, ADR-029) would silently vanish, making a shared mech read lower
   * than the same mech on its owner's sheet.
   *
   * The snapshot payload carries the refs, and this passes them in explicitly
   * rather than fabricating a pilot record — a synthetic pilot would surface in
   * the Linked Units rail as a unit that was never shared.
   */
  pilotAbilities?: string[]
}

export function Sheet({
  kind,
  id,
  entityStore,
  softLinkStore,
  store = useEntityStore,
  readOnly = false,
  pilotAbilities,
}: SheetProps) {
  const storeState = store()
  const [changeLogOpen, setChangeLogOpen] = useState(false)

  const lookup: EntityLookup = entityStore ?? {
    get: (type, entityId) => storeState.get(type, entityId),
  }
  const links = softLinkStore ? softLinkStore.softLinks : storeState.softLinks

  const composition = resolveSheetComposition({
    kind,
    id,
    links,
    store: lookup,
  })
  const resolved = resolveSheetEntity(lookup, kind, id)

  if (!resolved) {
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
            className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
          >
            &larr; Back to Roster
          </AppLink>
        </div>
      </main>
    )
  }

  const { entity } = resolved
  const wired = composition.mode === 'wired'
  const back = { href: '/', label: 'Roster' }
  // Top-bar trailing actions (app-bar right group, design source
  // clean-pilot.html `.bar-actions`): Share (publish) stays inline; Print,
  // Export and Workspace tuck into the "⋯" overflow at every width — the app
  // bar's priority row is just Share + overflow.
  // NO sheet has a global Edit toggle any more — editing is section-based
  // (unified edit language: per-section Edit buttons, always-available
  // collection add/remove, always-live StatBlock pips).
  // Print/PDF export (#82/#258): the print stylesheet (index.css @media
  // print) turns the live sheet into a clean paper layout; "Save as PDF"
  // in the browser dialog covers the PDF ask without a rendering dep.
  const printButton = (
    <button
      type="button"
      aria-label={`Print this ${kind} sheet`}
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'cursor-pointer')}
    >
      Print
    </button>
  )
  // Entity-level admin affordances relocated from the (removed) detail page:
  // single-entity JSON export + workspace assignment. Unassigning a linked
  // entity lives on the rail chip, not here — it's contextual to the link.
  const exportButton = <ExportEntityButton type={kind} id={id} name={entity.name} />
  const workspaceControl = (
    <AssignToWorkspaceButton
      entityType={kind}
      entityId={id}
      currentWorkspaceId={entity.workspaceId}
    />
  )
  // The per-entity Change Log (provenance) opens from the overflow menu, never
  // inline on the sheet body (ADR-022). Its open-state lives here, on the
  // always-mounted Sheet, because the menu unmounts its children when closed.
  const changeLogButton = (
    <button
      type="button"
      aria-label={`View the change log for this ${kind}`}
      onClick={() => setChangeLogOpen(true)}
      className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'cursor-pointer')}
    >
      Change Log
    </button>
  )
  const actions = !readOnly ? (
    <div className="flex items-center gap-2.5">
      <AppLink
        href={`/sheet/${kind}/${id}/share`}
        aria-label={`Share this ${kind} as a snapshot`}
        className={cn(buttonVariants({ size: 'compact' }), 'min-h-11 no-underline sm:min-h-9')}
      >
        Share
      </AppLink>
      <SheetActionsMenu>
        {printButton}
        {exportButton}
        {workspaceControl}
        {changeLogButton}
      </SheetActionsMenu>
    </div>
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

  /**
   * Persist a partial patch on the sheet's own entity (fire-and-forget).
   * The updater form receives the FRESHEST store record so array edits don't
   * race the async store.update round-trip (see SheetPatch docs).
   */
  const patch: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(storeState.get(kind, id) ?? entity) : input
    void storeState.update(kind, id, fields, LIVE_SHEET_MANUAL)
  }

  const common = {
    composition,
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

  const sheetView =
    resolved.kind === 'pilot' ? (
      <SheetPilot pilot={resolved.entity} {...common} />
    ) : resolved.kind === 'mech' ? (
      <SheetMech mech={resolved.entity} pilotAbilitiesOverride={pilotAbilities} {...common} />
    ) : (
      <SheetCrawler crawler={resolved.entity} {...common} />
    )

  return (
    <>
      {sheetView}
      {!readOnly && (
        <ChangeLogDrawer
          entityType={kind}
          entityId={id}
          entityName={entity.name}
          open={changeLogOpen}
          onOpenChange={setChangeLogOpen}
        />
      )}
    </>
  )
}
