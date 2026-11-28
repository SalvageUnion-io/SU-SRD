/**
 * The body of `AssignPicker`: its pick dialog, the candidates and the write.
 * A chunk of its own, fetched when a slot's picker first opens: a sheet
 * nobody assigns on never carries it. Its doc is `AssignPicker`'s.
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
import { useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { PickDialog } from '../../components/app'
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
import type { AssignPickerStore, SlotCopy } from './AssignPicker'

type Kind = EntityRef['type']

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

type AssignPickDialogProps = {
  subject: { type: Kind; id: string }
  container: Container
  pick: Kind
  exclude?: readonly string[] | undefined
  store?: AssignPickerStore | undefined
  onAssigned?: (() => void) | undefined
  /** The slot's words, from `AssignPicker`. */
  copy: SlotCopy
  open: boolean
  /** Close it: its own trigger's state, or the opener's `onClose`. */
  onClose: () => void
}

export function AssignPickDialog({
  subject,
  container,
  pick,
  exclude = [],
  store,
  onAssigned,
  copy,
  open,
  onClose,
}: AssignPickDialogProps) {
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  const { status } = useSync()

  // Always call the hooks (Rules of Hooks); prefer the injected lists.
  const livePilots = usePilots()
  const liveMechs = useMechs()
  const liveCrawlers = useCrawlers()
  const me = useMyPerson()
  const liveLinks = useUnits((s) => s.softLinks)

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

  function closeDialog() {
    onClose()
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
      onClose()
      onAssigned?.()
    } catch (err) {
      setError(refusalCopy(err))
    } finally {
      setPending(false)
    }
  }

  // Every opening starts clean: no pick, no refusal from the last one.
  // Adjusted during render, so the stale state never paints for a frame.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelectedId('')
      setError(null)
    }
  }

  return (
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
  )
}
