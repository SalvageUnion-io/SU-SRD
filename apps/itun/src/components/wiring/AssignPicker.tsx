/**
 * AssignPicker — the one assignment picker for every slot on a sheet's Linked
 * Units rail (ADR-037).
 *
 * A button that opens a radio list of candidates, then draws the link on
 * confirm. It replaces three near-identical dialogs (`AssignPilotToMech`,
 * `AssignCrawlerToPilot`, `AssignPilotToCrawler`) that differed only in which
 * kinds they listed and which way round the link pointed — and none of which
 * looked at where anything lived, so a pilot in one Game was offered every
 * crawler in every other Game, and the server refused the pick.
 *
 * ## Which candidates
 *
 * Only entities in the SUBJECT's container: the same Game, or My Stuff, which is
 * a solo Game for this purpose. Filtering applies only when `mode ===
 * 'connected'` — signed out there is one pile, and every entity is in it.
 *
 * The local store holds your own pilots and mechs plus every crawler in your
 * Games (`WiringSync`), which is exactly what you may assign: a link is written
 * by the owner of its `from` end, and crewmates' pilots and mechs are not
 * yours to wire.
 *
 * `exclude` drops the slot's current occupants, so "Change" never offers the
 * thing already there and "Add Crew" never offers someone already aboard.
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

import { Button, cn, FieldError, ModalShell, Radio } from 'component-lib'
import { useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { useCrawlers, useMechs, usePilots } from '../../hooks/entities'
import { useConnection } from '../../lib/connection/connectionContext'
import type { Container, ContainerFields } from '../../lib/container'
import { containerOf, sameContainer } from '../../lib/container'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { assignLink } from '../../lib/links/assignLink'
import { LinkRefused } from '../../lib/links/linkRefused'
import { linkTypeFor } from '../../lib/links/linkRules'
import { readReference } from '../../lib/readReference'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { WritesBlockedOffline } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { failureMessage } from '../shared/useConfirm'
import type { SoftLinkStore } from './useSoftLinks'

type Kind = EntityRef['type']

/** The store surface the picker reads and writes — injectable in tests. */
export type AssignPickerStore = SoftLinkStore & {
  pilots?: readonly Pilot[]
  mechs?: readonly Mech[]
  crawlers?: readonly Crawler[]
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
    assign: 'Assign Mech',
    assignAria: 'Assign mech to pilot',
    change: 'Change Mech',
    changeAria: 'Change mech for this pilot',
    title: 'Assign Mech to Pilot',
    confirm: 'Assign',
    confirmAria: 'Confirm mech assignment',
    pending: 'Assigning…',
    note: 'A pilot flies one mech and a mech carries one pilot — picking a mech already flown moves it to this pilot.',
  },
  'pilot.crawler': {
    assign: 'Assign Crawler',
    assignAria: 'Assign crawler to pilot',
    change: 'Change Crawler',
    changeAria: 'Change crawler for this pilot',
    title: 'Assign Pilot to Crawler',
    confirm: 'Assign',
    confirmAria: 'Confirm crawler assignment',
    pending: 'Assigning…',
    note: 'A pilot crews one crawler — picking another moves them there. Their mech is assigned separately.',
  },
  'mech.pilot': {
    assign: 'Assign Pilot',
    assignAria: 'Assign pilot to mech',
    change: 'Change Pilot',
    changeAria: 'Change pilot for this mech',
    title: 'Assign Pilot to Mech',
    confirm: 'Assign',
    confirmAria: 'Confirm pilot assignment',
    pending: 'Assigning…',
    note: 'A mech carries one pilot and a pilot flies one mech — picking a pilot already in another mech moves them here.',
  },
  'mech.crawler': {
    assign: 'Assign Crawler',
    assignAria: 'Assign crawler to mech',
    change: 'Change Crawler',
    changeAria: 'Change crawler for this mech',
    title: 'Dock Mech in Crawler',
    confirm: 'Assign',
    confirmAria: 'Confirm crawler assignment',
    pending: 'Assigning…',
    note: 'A mech docks in one crawler, on its own assignment — its pilot is assigned separately.',
  },
  'crawler.pilot': {
    assign: '+ Add Crew',
    title: 'Add Pilot to Crew',
    confirm: 'Add to Crew',
    confirmAria: 'Confirm crew assignment',
    pending: 'Adding…',
    note: 'A pilot crews one crawler — adding one already aboard another moves them here.',
  },
  'crawler.mech': {
    assign: '+ Dock Mech',
    title: 'Dock Mech in Crawler',
    confirm: 'Dock',
    confirmAria: 'Confirm mech docking',
    pending: 'Docking…',
    note: 'A mech docks in one crawler — docking one from another bay moves it here. Its pilot is assigned separately.',
  },
}

const NOUN: Record<Kind, { one: string; many: string }> = {
  pilot: { one: 'pilot', many: 'pilots' },
  mech: { one: 'mech', many: 'mechs' },
  crawler: { one: 'crawler', many: 'crawlers' },
  npc: { one: 'NPC', many: 'NPCs' },
}

type Candidate = { id: string; name: string; description?: string }

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
  name: p.name,
  description: p.callsign ? `“${p.callsign}”` : undefined,
})

const mechCandidate = (m: Mech): Candidate => ({
  id: m.id,
  name: m.name,
  description: chassisName(m.chassisRef),
})

const crawlerCandidate = (c: Crawler): Candidate => {
  const tl = parseCrawlerTechLevel(c.techLevel)
  return { id: c.id, name: c.name, description: tl === undefined ? undefined : `Tech ${tl}` }
}

/**
 * The empty-list copy: nothing of this kind where the subject lives at all, or
 * nothing left once the slot's occupants are excluded.
 */
function emptyCopy(kind: Kind, scope: Container | null, anyAtAll: boolean): string {
  const { many } = NOUN[kind]
  if (scope === null) {
    return anyAtAll ? `No other ${many} to pick.` : `No ${many} yet — create one first.`
  }
  if (scope.kind === 'game') {
    return anyAtAll ? `No other ${many} in this game.` : `No ${many} in this game yet.`
  }
  return anyAtAll ? `No other ${many} in My Stuff.` : `No ${many} in My Stuff.`
}

/** Player copy for a failed assignment. Never the raw message of a defect. */
function refusalCopy(err: unknown): string {
  if (err instanceof LinkRefused || err instanceof WritesBlockedOffline) return err.message
  return failureMessage(err, 'That assignment could not be saved. Try again.')
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
  className?: string
}

export function AssignPicker({
  subject,
  container,
  pick,
  filled = false,
  exclude = [],
  size = 'compact',
  store,
  onAssigned,
  className,
}: AssignPickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode } = useConnection()

  // Always call the hooks (Rules of Hooks); prefer the injected lists.
  const livePilots = usePilots()
  const liveMechs = useMechs()
  const liveCrawlers = useCrawlers()

  const copy = SLOT_COPY[`${subject.type}.${pick}`]
  if (!copy) {
    throw new Error(`AssignPicker: a ${subject.type} sheet has no ${pick} slot`)
  }

  // Signed out, there is one pile and no container to scope to.
  const scope = mode === 'connected' ? container : null
  const excluded = new Set(exclude)
  /** Everything of this kind where the subject lives, and what is left to offer. */
  const offer = <T extends ContainerFields & { id: string }>(
    list: readonly T[],
    toRow: (entity: T) => Candidate
  ): { inScope: number; rows: Candidate[] } => {
    const here = scope === null ? list : list.filter((e) => sameContainer(containerOf(e), scope))
    return { inScope: here.length, rows: here.filter((e) => !excluded.has(e.id)).map(toRow) }
  }
  const { inScope, rows: candidates } =
    pick === 'pilot'
      ? offer(store?.pilots ?? livePilots, pilotCandidate)
      : pick === 'mech'
        ? offer(store?.mechs ?? liveMechs, mechCandidate)
        : offer(store?.crawlers ?? liveCrawlers, crawlerCandidate)

  function openDialog() {
    setSelectedId('')
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setError(null)
  }

  async function handleConfirm() {
    if (!selectedId) {
      setError(`Please select a ${NOUN[pick].one}.`)
      return
    }
    // The schema fixes the direction: whichever end the link type starts from.
    const self = { type: subject.type, id: subject.id }
    const picked = { type: pick, id: selectedId }
    const [from, to] =
      linkTypeFor(self.type, picked.type) !== null ? [self, picked] : [picked, self]
    setPending(true)
    setError(null)
    try {
      await assignLink(from, to, store ?? useEntityStore.getState())
      setOpen(false)
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
      <Button size={size} onClick={openDialog} className={cn(className)} aria-label={ariaLabel}>
        {label}
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title={copy.title}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {candidates.length === 0 ? (
            <p className="font-body text-sm text-wk-muted">{emptyCopy(pick, scope, inScope > 0)}</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <Radio
                  key={c.id}
                  name={`${subject.type}-${pick}-select`}
                  value={c.id}
                  checked={selectedId === c.id}
                  onChange={() => setSelectedId(c.id)}
                  label={c.name}
                  description={c.description}
                />
              ))}
            </div>
          )}

          <p className="font-body text-xs text-wk-muted">{copy.note}</p>

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => void handleConfirm()}
              disabled={pending || candidates.length === 0}
              aria-label={copy.confirmAria}
            >
              {pending ? copy.pending : copy.confirm}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
