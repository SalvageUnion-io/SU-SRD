/**
 * "Move to a Game…" from a Training Bay item's ⋯ menu (Shelves).
 *
 * A short dialog that lists only where the server would accept this build
 * (`moveDestinations`, the client mirror of ADR-037): a pilot or mech into any
 * Game you are in, or out of one; a crawler only into a Game you run, or back
 * out of it. Out of a Game reads "Not in a Game", because in the Training Bay a
 * unit in a Game is still in your Training Bay — the move only changes where it
 * plays.
 *
 * Picking a destination closes the dialog and hands the move to `requestMove`,
 * which asks first when it should (always out of a Game; into one only when it
 * clears an assignment). The confirm is the page's, since this dialog is gone
 * by the time it opens. A move is one field on the same record, never a copy
 * (`apps/web/src/routes/CLAUDE.md`). A pilot moved into a Game brings the mech
 * assigned to them, still assigned (`bringPlan`).
 */

import type { Container, ContainerFields } from 'game-domain/container'
import { containerOf, moveTo, sameContainer } from 'game-domain/container'
import type { EntityKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { ModalShell, toast, tokens } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { moveDestinations } from '../../lib/games/gameRoster'
import { buildShelvesCopy } from '../../messages/build-shelves'
import type { Movable } from '../../play/games/addFromTrainingBay.model'
import { bringPlan } from '../../play/games/addFromTrainingBay.model'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { ContainerPicker } from '../entityContainer/ContainerPicker'
import { requestMove } from '../entityContainer/requestMove.model'

/** What "out of a Game" is called in the Training Bay. */
const NOT_IN_A_GAME = 'Not in a Game'

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[20],
} satisfies CSSProperties

/** The mech assigned to a pilot, where it sits in the pilot's own container: it moves with them. */
function mechThatFollows(
  store: Pick<ReturnType<typeof useUnits.getState>, 'pilots' | 'mechs' | 'softLinks'>,
  pilotId: string
): Movable | null {
  const pilot = store.pilots.find((p) => p.id === pilotId)
  const link = store.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)
  const mech = link === undefined ? undefined : store.mechs.find((m) => m.id === link.from.id)
  if (pilot === undefined || mech === undefined) return null
  if (!sameContainer(containerOf(pilot), containerOf(mech))) return null
  return { id: mech.id, name: mech.name, kind: 'mech' }
}

export type MoveSubject = {
  type: EntityKind
  id: string
  entity: ContainerFields & { name: string }
}

type MoveToGameDialogProps = {
  /** The build being moved, or null when the dialog is closed. */
  subject: MoveSubject | null
  onClose: () => void
  /** The Games this player is in; undefined while they load. */
  games: readonly MoveTargetGame[] | undefined
  /** The page's confirm, which outlives this dialog. */
  confirm: Confirm
}

export function MoveToGameDialog({ subject, onClose, games, confirm }: MoveToGameDialogProps) {
  const current = subject ? containerOf(subject.entity) : null
  const destinations =
    subject && current
      ? moveDestinations({ kind: subject.type, current, games: games ?? [] }).filter(
          (d) => !sameContainer(d.container, current)
        )
      : []

  function gameName(gameId: string): string | null {
    return games?.find((game) => game._id === gameId)?.name ?? null
  }

  function pick(next: Container, label: string) {
    if (!subject || !current) return
    const { type, id, entity } = subject
    onClose()
    // Into a Game a pilot's mech comes with them and stays assigned (LG-08),
    // as "Add from Training Bay" brings the pair.
    const store = useUnits.getState()
    const mech = type === 'pilot' && next.kind === 'game' ? mechThatFollows(store, id) : null
    const { moves, keep } = bringPlan(
      [{ id, name: entity.name, kind: type, mech }],
      store.softLinks
    )
    const move = async (to: Container) => {
      for (const unit of moves) {
        await useUnits.getState().update(unit.kind, unit.id, moveTo(to), CONTAINER_MOVE)
      }
      // The move pruned the pairing; both ends are in the Game now.
      for (const { id: _id, createdAt: _createdAt, ...link } of keep) {
        await useUnits.getState().create('softLink', link)
      }
      toast.success(
        mech === null
          ? buildShelvesCopy('movedTo', { name: entity.name, label })
          : buildShelvesCopy('movedPairTo', { name: entity.name, mech: mech.name, label })
      )
    }
    requestMove({
      entityType: type,
      entityId: id,
      name: entity.name,
      current,
      next,
      gameName,
      confirm,
      keep,
      move,
      moveNow: (to) => {
        move(to).catch((err: unknown) =>
          toast.error(failureMessage(err, `${entity.name} could not be moved. Try again.`))
        )
      },
    })
  }

  return (
    <ModalShell
      open={subject !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        subject
          ? buildShelvesCopy('move', { name: subject.entity.name })
          : buildShelvesCopy('move2')
      }
      width="narrow"
    >
      <div style={BODY}>
        <ContainerPicker
          variant="list"
          label={buildShelvesCopy('whereTo')}
          choices={
            games === undefined
              ? undefined
              : destinations.map((d) =>
                  d.container.kind === 'shelf' ? { ...d, label: NOT_IN_A_GAME } : d
                )
          }
          onPick={(choice) => pick(choice.container, choice.label)}
          loading="your Games"
          empty={
            subject?.type === 'crawler'
              ? buildShelvesCopy('aCrawlerGoesOnlyInto')
              : buildShelvesCopy('youAreInNoGame')
          }
        />
      </div>
    </ModalShell>
  )
}
