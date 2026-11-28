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

import type { Container } from 'game-domain/container'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { lazy, Suspense, useState } from 'react'
import { Button } from '../../components/index'
import { useOpenedOnce } from '../../lib/useOpenedOnce'
import { wiringCopy } from '../../messages/build-wiring'
import type { SoftLinkStore } from './useSoftLinks'

/** The dialog, its candidates and its write: fetched when it first opens. */
const AssignPickDialog = lazy(() =>
  import('./AssignPickDialog').then((m) => ({ default: m.AssignPickDialog }))
)

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

export type SlotCopy = {
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
  exclude,
  size = 'compact',
  store,
  onAssigned,
  control,
}: AssignPickerProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = control ? control.open : ownOpen
  const mounted = useOpenedOnce(open)

  const copy = SLOT_COPY[`${subject.type}.${pick}`]
  if (!copy) {
    throw new Error(`AssignPicker: a ${subject.type} sheet has no ${pick} slot`)
  }

  const label = filled && copy.change ? copy.change : copy.assign
  const ariaLabel = filled && copy.changeAria ? copy.changeAria : copy.assignAria

  return (
    <>
      {!control && (
        <Button size={size} onClick={() => setOwnOpen(true)} aria-label={ariaLabel}>
          {label}
        </Button>
      )}

      {mounted && (
        <Suspense fallback={null}>
          <AssignPickDialog
            subject={subject}
            container={container}
            pick={pick}
            exclude={exclude}
            store={store}
            onAssigned={onAssigned}
            copy={copy}
            open={open}
            onClose={control ? control.onClose : () => setOwnOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
