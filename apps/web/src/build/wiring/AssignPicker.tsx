/**
 * AssignPicker — the one assignment picker for every slot on a sheet's Linked
 * Units rail (ADR-037).
 *
 * A button that opens the one pick dialog (`PickDialog`) of candidates — each
 * the unit's Compact in select mode (EDL "Modes": ink ring and the "Selected"
 * seal), one radio group — then draws the link on confirm. One picker serves
 * every pairing of kinds, either way round the link points, and offers only
 * what the server would accept: a pilot in one Game is never offered a
 * crawler in another.
 *
 * ## Which candidates
 *
 * Only entities in the SUBJECT's container: the same Game, or your shelves, which is
 * a solo Game for this purpose. Filtering applies only when `mode ===
 * 'connected'` — signed out there is one pile, and every entity is in it.
 *
 * The local store holds your own pilots and mechs plus every crawler in your
 * Games (`RoomFeed`), which is exactly what you may assign: a link is written
 * by the owner of its `from` end, and crewmates' pilots and mechs are not
 * yours to wire.
 *
 * `exclude` drops the slot's current occupants, so "Change" never offers the
 * thing already there and "Add Crew" never offers someone already aboard.
 *
 * In a Game, your own pilots and mechs still in your Training Bay are offered
 * too, under their own Slab: picking one moves it into the Game (the Training
 * Bay's move, ADR-037) and then assigns it, so an empty Game is never a dead
 * end. What the move clears is said before the player commits.
 *
 * ## Which way the link points
 *
 * Fixed by the schema, not by which sheet you are on (`linkTypeFor`): a mech is
 * always the `from` end of `mech-to-pilot`, a pilot of `pilot-to-crawler`. From
 * a pilot sheet the picked mech is `from`; from a mech sheet the mech itself
 * is. The write goes through `assignLink`, which REPLACES whatever the new link
 * conflicts with in the same write — so "Change" is just "Assign" again.
 *
 * ## Refusals
 *
 * Shown inline, in the dialog the player is still looking at: a `LinkRefused`
 * (the store saw it coming, or the server said no) and `WritesBlockedOffline`
 * both carry copy written for a player. Anything else is a defect — reported,
 * and replaced by generic copy rather than its raw message.
 */

import type { Container, ContainerFields } from 'game-domain/container'
import { containerOf, moveTo, sameContainer } from 'game-domain/container'
import { linkTypeFor } from 'game-domain/links/linkRules'
import { pilotLabel } from 'game-domain/pilotLabel'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { useEffect, useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { PickDialog } from '../../components/app'
import { Button } from '../../components/index'
import { useMyPerson } from '../../lib/auth/session'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useCrawlers, useMechs, usePilots } from '../../lib/entities'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { assignLink } from '../../lib/links/assignLink'
import { assignmentsClearedByMove } from '../../lib/links/clearedByMove'
import { LinkRefused } from '../../lib/links/linkRefused'
import { readReference } from '../../lib/readReference'
import type { UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { wiringCopy } from '../../messages/build-wiring'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { holderOf } from '../../replica/replica'
import { WritesBlockedOffline } from '../../replica/sync'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import type { SoftLinkStore } from './useSoftLinks'

type Kind = EntityRef['type']

/** The store surface the picker reads and writes — injectable in tests. */
export type AssignPickerStore = SoftLinkStore & {
  pilots?: readonly Pilot[]
  mechs?: readonly Mech[]
  crawlers?: readonly Crawler[]
  /** Who a Game holds a unit for (`holderOf`), and who the viewer is. */
  holders?: {
    me: string | null
    of: (kind: 'pilot' | 'mech', id: string) => string | null | undefined
  }
}

/** A slot on a rail: the sheet's own kind, then the kind the slot takes. */
type Slot = `${Kind}.${Kind}`

type SlotCopy = {
  /** Visible trigger text, empty slot. */
  assign: string
  /**
   * Accessible name, empty slot, when the visible text alone is ambiguous on
   * the page. Contains the visible text (WCAG 2.5.3, label in name).
   */
  assignAria?: string
  /** Visible trigger text when the slot is filled; absent for list slots. */
  change?: string
  changeAria?: string
  title: string
  confirm: string
  confirmAria: string
  pending: string
  /** Said where the question arises: what picking an assigned one does. */
  note: string
}

const SLOT_COPY: Partial<Record<Slot, SlotCopy>> = {
  'pilot.mech': {
    assign: wiringCopy('assignMech'),
    assignAria: wiringCopy('assignMechToPilot'),
    change: wiringCopy('changeMech'),
    changeAria: wiringCopy('changeMechForThisPilot'),
    title: wiringCopy('assignMechToPilot'),
    confirm: 'Assign',
    confirmAria: wiringCopy('confirmMechAssignment'),
    pending: 'Assigning…',
    note: wiringCopy('aPilotFliesOneMech'),
  },
  'pilot.crawler': {
    assign: wiringCopy('assignCrawler'),
    assignAria: wiringCopy('assignCrawlerToPilot'),
    change: wiringCopy('changeCrawler'),
    changeAria: wiringCopy('changeCrawlerForThisPilot'),
    title: wiringCopy('assignPilotToCrawler'),
    confirm: 'Assign',
    confirmAria: wiringCopy('confirmCrawlerAssignment'),
    pending: 'Assigning…',
    note: wiringCopy('aPilotCrewsOneCrawler'),
  },
  'mech.pilot': {
    assign: wiringCopy('assignPilot'),
    assignAria: wiringCopy('assignPilotToMech'),
    change: wiringCopy('changePilot'),
    changeAria: wiringCopy('changePilotForThisMech'),
    title: wiringCopy('assignPilotToMech'),
    confirm: 'Assign',
    confirmAria: wiringCopy('confirmPilotAssignment'),
    pending: 'Assigning…',
    note: wiringCopy('aMechCarriesOnePilot'),
  },
  'mech.crawler': {
    assign: wiringCopy('assignCrawler'),
    assignAria: wiringCopy('assignCrawlerToMech'),
    change: wiringCopy('changeCrawler'),
    changeAria: wiringCopy('changeCrawlerForThisMech'),
    title: wiringCopy('assignMechToCrawler'),
    confirm: 'Assign',
    confirmAria: wiringCopy('confirmCrawlerAssignment'),
    pending: 'Assigning…',
    note: wiringCopy('aMechIsAssignedTo'),
  },
  'crawler.pilot': {
    assign: wiringCopy('addCrew'),
    title: wiringCopy('addPilotToCrew'),
    confirm: wiringCopy('addToCrew'),
    confirmAria: wiringCopy('confirmCrewAssignment'),
    pending: 'Adding…',
    note: wiringCopy('aPilotCrewsOneCrawler2'),
  },
  'crawler.mech': {
    assign: wiringCopy('plusAssignMech'),
    title: wiringCopy('assignMechToCrawler'),
    confirm: 'Assign',
    confirmAria: wiringCopy('confirmMechAssignment'),
    pending: 'Assigning…',
    note: wiringCopy('aMechIsAssignedTo2'),
  },
}

/** What the empty list calls the kind it found none of. */
const MANY: Record<Kind, string> = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
  npc: 'NPCs',
}

/** A candidate's Compact: its name, what it is built as, and its readings as chips. */
type Candidate = { id: string; name: string; note?: string | undefined; readings?: UnitReading[] }

/** Chassis name for a mech row, best-effort (reference data may not be loaded). */
function chassisName(chassisRef: string): string | undefined {
  const chassis = readReference(
    'AssignPicker.chassisName',
    () => resolveChassisRef(chassisRef),
    null
  )
  return chassis?.name ?? (chassisRef || undefined)
}

const pilotCandidate = (p: Pilot): Candidate => ({
  id: p.id,
  // Callsign first, as everywhere a pilot is named (`pilotLabel`).
  name: pilotLabel(p),
  readings: [],
})

const mechCandidate = (m: Mech): Candidate => ({
  id: m.id,
  name: m.name,
  note: chassisName(m.chassisRef),
})

const crawlerCandidate = (c: Crawler): Candidate => ({
  id: c.id,
  name: c.name,
  readings: [{ label: wiringCopy('tl'), value: c.techLevel }],
})

/**
 * Whether a Mech of the viewer's may take this Game's Pilot (r5 B16): their
 * own, or one assigned to nobody whose Mech, if any, is theirs or this one.
 * The room refuses the rest (`PAIRED_ELSEWHERE`), so they are not offered.
 */
function mayTakePilot(
  pilotId: string,
  mechId: string,
  links: readonly SoftLink[],
  holders: NonNullable<AssignPickerStore['holders']>
): boolean {
  const mine = (kind: 'pilot' | 'mech', id: string) => {
    const holder = holders.of(kind, id)
    return holder === undefined || holder === holders.me
  }
  if (mine('pilot', pilotId)) return true
  if (holders.of('pilot', pilotId) !== null) return false
  const flies = links.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)?.from.id
  return flies === undefined || flies === mechId || mine('mech', flies)
}

/**
 * The empty-list copy: nothing of this kind where the subject lives at all, or
 * nothing left once the slot's occupants are excluded.
 */
function emptyCopy(kind: Kind, scope: Container | null, anyAtAll: boolean): string {
  const many = MANY[kind]
  if (scope === null) {
    return anyAtAll
      ? wiringCopy('noOtherToPick', { many })
      : wiringCopy('noneYetCreateOneFirst', { many })
  }
  if (scope.kind === 'game') {
    return anyAtAll
      ? wiringCopy('noOtherInThisGame', { many })
      : wiringCopy('noneInThisGameYet', { many })
  }
  return anyAtAll
    ? wiringCopy('noOtherInYourTrainingBay', { many })
    : wiringCopy('noneInYourTrainingBay', { many })
}

/** Player copy for a failed assignment. Never the raw message of a defect. */
function refusalCopy(err: unknown): string {
  if (err instanceof LinkRefused || err instanceof WritesBlockedOffline) return err.message
  return failureMessage(err, wiringCopy('assignmentNotSaved'))
}

type AssignPickerProps = {
  /** The entity whose sheet holds the slot. */
  subject: { type: Kind; id: string }
  /** Where the subject lives — candidates must live there too. */
  container: Container
  /** The kind of entity the slot takes. */
  pick: Kind
  /** The slot already holds something: the trigger reads "Change…". */
  filled?: boolean
  /** Ids not to offer — the slot's current occupant(s). */
  exclude?: readonly string[]
  /** Trigger size: `compact` in an empty slot's foot, `mini` beside a row's View. */
  size?: 'compact' | 'mini'
  /** Inject to avoid the Zustand global in tests. */
  store?: AssignPickerStore
  onAssigned?: () => void
  /**
   * Opened from elsewhere (a unit Mini's ⋯, R62): no trigger of its own, the
   * dialog open while `open` is, `onClose` when it closes.
   */
  control?: PickerControl
}

/** A picker opened by another control: whether it is open, and how it closes. */
export type PickerControl = { open: boolean; onClose: () => void }

export function AssignPicker({
  subject,
  container,
  pick,
  filled = false,
  exclude = [],
  size = 'compact',
  store,
  onAssigned,
  control,
}: AssignPickerProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = control ? control.open : ownOpen
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { status } = useSync()

  // Always call the hooks (Rules of Hooks); prefer the injected lists.
  const livePilots = usePilots()
  const liveMechs = useMechs()
  const liveCrawlers = useCrawlers()
  const me = useMyPerson()
  const liveLinks = useUnits((s) => s.softLinks)

  const copy = SLOT_COPY[`${subject.type}.${pick}`]
  if (!copy) {
    throw new Error(`AssignPicker: a ${subject.type} sheet has no ${pick} slot`)
  }

  // Signed out, there is one pile and no container to scope to.
  const scope = status === 'live' ? container : null
  const excluded = new Set(exclude)
  /** Everything of this kind where the subject lives, and what is left to offer. */
  const offer = <T extends ContainerFields & { id: string }>(
    list: readonly T[],
    toRow: (entity: T) => Candidate
  ): { inScope: number; rows: Candidate[] } => {
    const here = scope === null ? list : list.filter((e) => sameContainer(containerOf(e), scope))
    return { inScope: here.length, rows: here.filter((e) => !excluded.has(e.id)).map(toRow) }
  }
  // A Mech in a Game is offered only the Pilots it may take (r5 B16).
  const holders = store?.holders ?? { me, of: holderOf }
  const links = store?.softLinks ?? liveLinks
  const pilotsHere = (store?.pilots ?? livePilots).filter(
    (p) =>
      scope?.kind !== 'game' ||
      subject.type !== 'mech' ||
      mayTakePilot(p.id, subject.id, links, holders)
  )
  const { inScope, rows: candidates } =
    pick === 'pilot'
      ? offer(pilotsHere, pilotCandidate)
      : pick === 'mech'
        ? offer(store?.mechs ?? liveMechs, mechCandidate)
        : offer(store?.crawlers ?? liveCrawlers, crawlerCandidate)

  // In a Game, your own pilots and mechs still in the Training Bay: picked,
  // each moves in first. A crawler moves only into a Game its owner runs, so it
  // is never offered here.
  const shelf =
    scope?.kind === 'game' && (pick === 'pilot' || pick === 'mech')
      ? (pick === 'pilot'
          ? (store?.pilots ?? livePilots).map((e) => [e, pilotCandidate(e)] as const)
          : (store?.mechs ?? liveMechs).map((e) => [e, mechCandidate(e)] as const)
        )
          .filter(([e]) => containerOf(e).kind === 'shelf' && !excluded.has(e.id))
          .map(([, row]) => row)
      : []
  const shelfIds = new Set(shelf.map((row) => row.id))
  const movesIn = shelfIds.has(selectedId) && scope?.kind === 'game' ? scope : null
  const movingName = shelf.find((row) => row.id === selectedId)?.name ?? ''
  const cleared =
    movesIn === null
      ? []
      : assignmentsClearedByMove(useUnits.getState(), { type: pick, id: selectedId }, movesIn)

  function openDialog() {
    setSelectedId('')
    setError(null)
    setOwnOpen(true)
  }

  // Opened from outside, it starts clean as its own trigger would.
  const controlOpen = control?.open === true
  useEffect(() => {
    if (!controlOpen) return
    setSelectedId('')
    setError(null)
  }, [controlOpen])

  function closeDialog() {
    if (control) control.onClose()
    else setOwnOpen(false)
    setError(null)
  }

  async function handleConfirm(pickedId: string) {
    // The schema fixes the direction: whichever end the link type starts from.
    const self = { type: subject.type, id: subject.id }
    const picked = { type: pick, id: pickedId }
    const [from, to] =
      linkTypeFor(self.type, picked.type) !== null ? [self, picked] : [picked, self]
    setPending(true)
    setError(null)
    try {
      // From the Training Bay: the same record moves into the Game first (a
      // link never crosses containers), then is assigned.
      if (shelfIds.has(pickedId) && scope?.kind === 'game') {
        await useUnits.getState().update(pick, pickedId, moveTo(scope), CONTAINER_MOVE)
      }
      await assignLink(from, to, store ?? useUnits.getState())
      if (control) control.onClose()
      else setOwnOpen(false)
      onAssigned?.()
    } catch (err) {
      setError(refusalCopy(err))
    } finally {
      setPending(false)
    }
  }

  const label = filled && copy.change ? copy.change : copy.assign
  const ariaLabel = filled && copy.changeAria ? copy.changeAria : copy.assignAria

  return (
    <>
      {!control && (
        <Button size={size} onClick={openDialog} aria-label={ariaLabel}>
          {label}
        </Button>
      )}

      <PickDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title={copy.title}
        groups={[
          {
            key: pick,
            ...(shelf.length > 0 ? { title: wiringCopy('inThisGame') } : {}),
            choices: candidates.map((c) => ({
              id: c.id,
              label: c.name,
              model: unitRowModel({ kind: pick, name: c.name, note: c.note, readings: c.readings }),
            })),
          },
          {
            key: 'shelf',
            title: wiringCopy('fromYourTrainingBay'),
            choices: shelf.map((c) => ({
              id: c.id,
              label: c.name,
              model: unitRowModel({ kind: pick, name: c.name, note: c.note, readings: c.readings }),
            })),
          },
        ]}
        empty={emptyCopy(pick, scope, inScope > 0)}
        selected={selectedId || null}
        onSelect={setSelectedId}
        note={
          movesIn === null
            ? scope?.kind === 'game' && subject.type === 'mech' && pick === 'pilot'
              ? wiringCopy('aMechCarriesOnePilotHere')
              : copy.note
            : cleared.length > 0
              ? ROW_ACTION_COPY.enterGame({
                  name: movingName,
                  kind: pick,
                  game: null,
                  cleared,
                }).body.join(' ')
              : wiringCopy('movesIntoThisGame', { name: movingName })
        }
        error={error}
        confirmLabel={
          pending ? copy.pending : movesIn === null ? copy.confirm : wiringCopy('moveInAndAssign')
        }
        confirmAria={copy.confirmAria}
        confirm={selectedId ? () => void handleConfirm(selectedId) : undefined}
        pending={pending}
      />
    </>
  )
}
