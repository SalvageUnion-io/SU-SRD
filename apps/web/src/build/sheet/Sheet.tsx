/**
 * Sheet — root live-sheet component on the Header C LiveSheet shell. Resolves
 * the entity + its SoftLink composition (the ported
 * resolver in composition.model.ts), then dispatches to ONE per-kind view
 * (SheetPilot / SheetMech / SheetCrawler):
 * hero = entity-card-writ-large with live trackers, linked entities as rail
 * chips (live mini stats, whole-chip navigation), variant sheet as the body.
 *
 * Linked entities are not co-rendered as full sheets — they live in the rail
 * and navigate.
 *
 * Stats are store-backed: hero trackers write current* fields through the
 * entity store; the condensed strip reads the same record, so hero and strip
 * stay in lockstep (§4.1). Sheet keeps the (deliberately broad) store
 * subscription — composition is cross-type, every linked record renders
 * live — and hands the views resolved data via props.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { sheetPath } from 'game-domain/entityKinds'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Button, tokens } from '../../components/index'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { useConfirm } from '../../components/shared/useConfirm'
import { WritesBlockedNotice } from '../../components/shared/WritesBlockedNotice'
import { useConnection } from '../../lib/connection/connectionContext'
import { runWrite } from '../../lib/runWrite'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { MoveToContainerControl } from '../entityContainer/MoveToContainerControl'
import { ExportEntityButton } from '../export/ExportEntityButton'
import { SavePatternDialog } from '../mech/Pattern/SavePatternDialog'
import { ShareStatusDialog } from '../sharing/ShareStatusDialog'
import type { SoftLinkStore } from '../wiring/useSoftLinks'
import { ChangeLogDrawer } from './ChangeLogDrawer'
import type { EntityLookup } from './composition.model'
import { resolveSheetComposition } from './composition.model'
import type { LiveSheetSegment } from './LiveSheet'
import { SheetActionsMenu } from './SheetActionsMenu'
import { SheetCrawler } from './SheetCrawler'
import { SheetMech } from './SheetMech'
import { SheetModeToggle } from './SheetModeToggle'
import { SheetPilot } from './SheetPilot'
import { useSheetMode } from './sheetMode.model'
import type { SheetBand, SheetPatch, WithheldUnit } from './sheetViewProps.model'
import type { OwnerOf } from './unitOwners.model'

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
  kind: SheetKind,
  id: string
): ResolvedSheetEntity | null {
  const entity = lookup.get(kind, id)
  // `lookup.get` returns the record of the kind it is asked for; TS cannot
  // correlate the two across the union, so the pair is asserted once here.
  return entity === null ? null : ({ kind, entity } as ResolvedSheetEntity)
}

type SheetProps = {
  kind: SheetKind
  id: string
  /** Injectable entity lookup for testing; the live store when omitted. */
  entityStore?: EntityLookup
  /** Injectable soft-link snapshot for testing; the live store when omitted. */
  softLinkStore?: SoftLinkStore
  /** Injectable store hook (writes); the real Zustand store when omitted. */
  store?: typeof useEntityStore
  /**
   * Hides Share + disables all stat editing (a sheet the viewer cannot write:
   * the public sheet, a crewmate's sheet in a Game, a Starter Set template).
   *
   * This is the *caller's* declaration that the sheet is a read-only rendering.
   * Connectivity read-only is resolved separately, from `useConnection()`, and
   * ORs into the same downstream `readOnly` — the two reasons are different but
   * the affordances they withdraw are identical.
   */
  readOnly?: boolean
  /**
   * The viewer may not write the Game's crawler: a player, whose crawler the
   * Mediator keeps (ADR-038 §5). Only the server knows the viewer's role, so
   * `SheetView` decides; the crawler-side cargo moves and scrap draws on a
   * pilot's or mech's own sheet close, and nothing else does.
   */
  crawlerReadOnly?: boolean
  /**
   * Where the not-found state's exit link goes. Defaults to the Shelves. The
   * sheet itself has no back link (the band starts the page).
   *
   * A sheet reached from a Game's crew list belongs to that game for the length
   * of the visit, and sending its exit link to the personal Shelves would strand
   * the viewer one surface away from the crew they were reading.
   */
  back?: { href: string; label: string }
  /**
   * Pilot ability refs to use instead of the composition's.
   *
   * A read-only sheet (the public sheet, `PublicSheet.tsx`) shows a LIVE
   * INSTANCE but carries a private read-only store with no pilot record and no
   * soft-links, so the composition resolves `pilot: null` — and pilot-sourced
   * contributions (Beefcake's +3+X Max SP and +6 Cargo, ADR-029) would silently
   * vanish, making a shared mech read lower than the same mech on its owner's
   * sheet.
   *
   * The public-sheet query resolves the refs server-side, and this passes them
   * in explicitly rather than fabricating a pilot record — a synthetic pilot
   * would surface in the Assigned Units rail as a unit that was never shared.
   */
  pilotAbilities?: string[]
  /**
   * Entities the viewer may read but not edit — a Game's crewmates, from
   * `listForGame` (`readOnlySheetStore.model.ts`). Assigned units the store does not
   * hold resolve through it, so your crawler lists its whole crew and your
   * pilot shows the crewmate's mech flying them. Nothing on the sheet writes to
   * what only this holds (`holds` in `sheetViewProps.model.ts`).
   */
  others?: EntityLookup
  /** Where a linked unit's View goes; the live sheet route when omitted. */
  hrefFor?: (kind: EntityRef['type'], id: string) => string | undefined
  /** Assigned units to name without reading — a public sheet's private assignments. */
  withheld?: readonly WithheldUnit[]
  /** Controls on the band (the Starter Set's "Make a copy"). */
  bandActions?: ReactNode
  /** Who holds each unit in the Game: the owner chips on its Assigned units. */
  ownerOf?: OwnerOf
}

const NONE_WITHHELD: readonly WithheldUnit[] = []

/** The bar's trailing cluster: Share (or the offline lozenge) and ⋯. */
const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

export function Sheet({
  kind,
  id,
  entityStore,
  softLinkStore,
  store = useEntityStore,
  readOnly: readOnlyProp = false,
  crawlerReadOnly = false,
  back = { href: '/', label: 'Training Bay' },
  pilotAbilities,
  others,
  hrefFor = sheetPath,
  withheld = NONE_WITHHELD,
  ownerOf,
  bandActions,
}: SheetProps) {
  const storeState = store()
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [savePatternOpen, setSavePatternOpen] = useState(false)
  // The container move's confirm. Owned here, not by the control, because the
  // control lives in the ⋯ menu, which unmounts on the press that answers it.
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { canWrite, settling } = useConnection()
  // Read | Edit (`sheetMode.model.ts`): the route's choice, or always writable when
  // nothing provides one (a test).
  const sheetMode = useSheetMode()
  const editing = sheetMode === null || sheetMode.editing

  // Signed in and offline: the server of record refuses writes (ADR-030 §1), so
  // every edit affordance on this sheet is a lie. Withdraw them rather than
  // letting each one throw `WritesBlockedOffline` on click.
  //
  // `settling` is excluded on purpose. It is the sub-second initial handshake,
  // and folding it in here would make every signed-in load flash a read-only
  // sheet — which reads as a bug far more loudly than it reads as honesty. A
  // write attempted inside that window is still refused, and `runWrite` says so.
  //
  // This is orthogonal to ADR-021's surface taxonomy: it withdraws Free Edit for
  // a connectivity reason, and imposes no lifecycle enforcement on what remains.
  const writesBlocked = !canWrite && !settling
  // Read is the printed sheet: every edit affordance withdrawn, exactly as on
  // a sheet the viewer cannot write, until Edit is pressed.
  const readOnly = readOnlyProp || writesBlocked || !editing

  const own: EntityLookup = entityStore ?? {
    get: (type, entityId) => storeState.get(type, entityId),
  }
  const lookup: EntityLookup = others
    ? { get: (type, entityId) => own.get(type, entityId) ?? others.get(type, entityId) }
    : own
  const holds = (type: EntityRef['type'], entityId: string) => own.get(type, entityId) !== null
  const links = softLinkStore ? softLinkStore.softLinks : storeState.softLinks

  const linked = resolveSheetComposition({
    kind,
    id,
    links,
    store: lookup,
  })
  // A crawler's Hold trades cargo with its first docked mech, so that has to be
  // one this sheet can write — a crewmate's mech docked alongside is listed on
  // the rail, never offered as a transfer target.
  const composition =
    kind === 'crawler' && others
      ? { ...linked, mech: linked.crawlerMechs.find((m) => holds('mech', m.id)) ?? null }
      : linked
  const resolved = resolveSheetEntity(own, kind, id)

  if (!resolved) {
    // Styled not-found with an exit path — this is the most-visited surface
    // in the app; a bare one-liner stranded the user.
    return (
      <NotFoundPanel
        title={`${kind} not found`}
        message={`This ${kind} may have been deleted, or the link may be stale.`}
        back={back}
      />
    )
  }

  const { entity } = resolved
  const wired = composition.mode === 'wired'
  // Top-bar trailing actions (app-bar right group, design source
  // clean-pilot.html `.bar-actions`): Share stays inline; Print,
  // Export and the container control tuck into the "⋯" overflow at every width — the app
  // bar's priority row is just Share + overflow.
  // Read | Edit is the band's (`sheetMode.model.ts`): Read withdraws every write
  // affordance; Edit gives back the unified edit language (in-place fields,
  // collection add/remove, live pips).
  // Print/PDF export: the print stylesheet (`styles/build/print.css`)
  // turns the live sheet into a clean paper layout; "Save as PDF"
  // in the browser dialog covers the PDF ask without a rendering dep.
  const printButton = (
    <Button variant="ghost" aria-label={`Print this ${kind} sheet`} onClick={() => window.print()}>
      Print
    </Button>
  )
  // Entity-level admin affordances relocated from the (removed) detail page:
  // single-entity JSON export + container move. Unassigning a linked entity
  // lives on the rail chip, not here — it's contextual to the link.
  const exportButton = <ExportEntityButton type={kind} id={id} name={entity.name} />
  const containerControl = (
    <MoveToContainerControl entityType={kind} entityId={id} entity={entity} confirm={confirm} />
  )
  // The per-entity Change Log (provenance) opens from the overflow menu, never
  // inline on the sheet body (ADR-022). Its open-state lives here, on the
  // always-mounted Sheet, because the menu unmounts its children when closed.
  const changeLogButton = (
    <Button
      variant="ghost"
      aria-label={`View the change log for this ${kind}`}
      onClick={() => setChangeLogOpen(true)}
    >
      Change Log
    </Button>
  )
  // A mech saves as a pattern in a dialog over its sheet (board P1): a write,
  // so it is offered only where this sheet can write.
  const savePatternLink =
    kind === 'mech' && !writesBlocked ? (
      <Button variant="ghost" size="compact" onClick={() => setSavePatternOpen(true)}>
        Save as pattern
      </Button>
    ) : null
  // Gated on the PROP, not the resolved `readOnly`: Print, Export and the Change
  // Log are reads, and a disconnected player has more reason to want a local
  // export, not less. Only Share goes — switching the public sheet on or off is
  // a write to a server this session cannot reach — and the lozenge takes its
  // place so the gap says what happened.
  //
  // Share opens a dialog OVER this sheet rather than navigating to a share
  // screen. That screen's whole left half was a preview of the sheet you were
  // one click away from; standing on the real thing is a better preview than any
  // component could be, and it cannot disagree with what the recipient sees.
  // See ShareStatusDialog's header.
  const actions = !readOnlyProp ? (
    <div style={ACTIONS}>
      {writesBlocked ? (
        <WritesBlockedNotice />
      ) : (
        <Button
          aria-label={`Share this ${kind}`}
          onClick={() => setShareOpen(true)}
          className="su-page-action"
        >
          Share
        </Button>
      )}
      <SheetActionsMenu>
        {printButton}
        {exportButton}
        {containerControl}
        {savePatternLink}
        {changeLogButton}
      </SheetActionsMenu>
    </div>
  ) : undefined

  // Mobile segmented Pilot/Mech/Crawler switch — wired sheets
  // only; each present counterpart gets a segment, the viewed kind is active.
  // A counterpart with nowhere to go (`hrefFor` → undefined) gets no segment.
  let segments: LiveSheetSegment[] | undefined
  if (wired) {
    segments = []
    const counterparts = [
      { key: 'pilot', label: 'Pilot', unit: composition.pilot },
      { key: 'mech', label: 'Mech', unit: composition.mech },
      { key: 'crawler', label: 'Crawler', unit: composition.crawler },
    ] as const
    for (const { key, label, unit } of counterparts) {
      const href = unit ? hrefFor(key, unit.id) : undefined
      if (unit && href !== undefined) {
        segments.push({ key, label, name: unit.name, href, active: kind === key })
      }
    }
  }

  /**
   * Persist a partial patch on the sheet's own entity (fire-and-forget).
   * The updater form receives the FRESHEST store record so array edits don't
   * race the async store.update round-trip (see SheetPatch docs).
   */
  const patch: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(storeState.get(kind, id) ?? entity) : input
    // `runWrite`, not `void`: the store refuses a write whose backend is blocked,
    // and a bare `void` on that turns a refusal into an unhandled rejection and a
    // control that visibly does nothing.
    runWrite(() => storeState.update(kind, id, fields, LIVE_SHEET_MANUAL))
  }

  // The band: the type stamps' provenance, and Read | Edit only where the
  // viewer may write. A read-only sheet (`readOnlyProp`: the Starter Set's, a
  // crewmate's, a public one) has nothing to switch to, so it prints no toggle
  // at all — a disabled Edit was a control that could only say no.
  const modeToggle =
    sheetMode !== null && !readOnlyProp && !writesBlocked ? (
      <SheetModeToggle mode={sheetMode} kind={kind} />
    ) : null
  const band: SheetBand = {
    actions:
      modeToggle === null && bandActions === undefined ? undefined : (
        <>
          {modeToggle}
          {bandActions}
        </>
      ),
  }

  const common = {
    band,
    composition,
    actions,
    segments,
    editable: !readOnly,
    readOnly,
    ownerOf,
    crawlerReadOnly,
    store,
    storeState,
    holds,
    hrefFor,
    withheld,
    patch,
  }

  const sheetView =
    resolved.kind === 'pilot' ? (
      <SheetPilot pilot={resolved.entity} {...common} />
    ) : resolved.kind === 'mech' ? (
      <SheetMech mech={resolved.entity} pilotAbilities={pilotAbilities} {...common} />
    ) : (
      <SheetCrawler
        crawler={resolved.entity}
        liveCondition={!readOnlyProp && !writesBlocked}
        {...common}
      />
    )

  return (
    <>
      {sheetView}
      {!readOnlyProp && (
        <>
          <ChangeLogDrawer
            entityType={kind}
            entityId={id}
            entityName={entity.name}
            open={changeLogOpen}
            onOpenChange={setChangeLogOpen}
          />
          {/*
            Mounted here, beside the Change Log, for the same reason: the dialog
            must outlive the control that opens it. Its contents (and the
            public-sheet query inside them) render only while it is open, so an
            always-mounted dialog costs nothing on a sheet nobody shares.
          */}
          <ShareStatusDialog
            kind={kind}
            id={id}
            name={entity.name}
            gameId={entity.gameId ?? null}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
          {resolved.kind === 'mech' && (
            <SavePatternDialog
              source={resolved.entity}
              open={savePatternOpen}
              onOpenChange={setSavePatternOpen}
            />
          )}
          {confirmDialog}
        </>
      )}
    </>
  )
}
