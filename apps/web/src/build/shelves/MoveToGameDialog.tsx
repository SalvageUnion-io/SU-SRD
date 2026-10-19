/**
 * "Move to a Game…" from a shelf item's ⋯ menu (Shelves, board S1).
 *
 * A short dialog that lists only where the server would accept this build
 * (`moveDestinations`, the client mirror of ADR-037): a pilot or mech into any
 * Game you are in, or out of one; a crawler only into a Game you run, or back
 * out of it. Out of a Game reads "Unassigned", because in the Hangar a unit in
 * a Game is still in your Hangar — the move only changes where it plays.
 *
 * Picking a destination closes the dialog and hands the move to `requestMove`,
 * which asks first when it should (always out of a Game; into one only when it
 * clears an assignment). The confirm is the page's, since this dialog is gone
 * by the time it opens. A move is one field on the same record, never a copy
 * (`apps/web/src/routes/CLAUDE.md`).
 */

import type { Container, ContainerFields } from 'game-domain/container'
import { containerOf, moveTo, sameContainer } from 'game-domain/container'
import type { CSSProperties } from 'react'
import { failureMessage } from '../../lib/connection/useServerAction'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { moveDestinations } from '../../lib/games/gameRoster'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { AssignableType } from '../../stores/types'
import { ContainerPicker } from '../entityContainer/ContainerPicker'
import { requestMove } from '../entityContainer/requestMove.model'
import { ModalShell, toast, tokens } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'

/** What "out of a Game" is called in the Hangar, as on its chip. */
const UNASSIGNED = 'Unassigned'

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[20],
} satisfies CSSProperties

export type MoveSubject = {
  type: AssignableType
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
    const move = async (to: Container) => {
      await useEntityStore.getState().update(type, id, moveTo(to), CONTAINER_MOVE)
      toast.success(`Moved ${entity.name} to ${label}.`)
    }
    requestMove({
      entityType: type,
      entityId: id,
      name: entity.name,
      current,
      next,
      gameName,
      confirm,
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
      title={subject ? `Move ${subject.entity.name}` : 'Move'}
      width="narrow"
    >
      <div style={BODY}>
        <ContainerPicker
          variant="list"
          label="Where to"
          choices={
            games === undefined
              ? undefined
              : destinations.map((d) =>
                  d.container.kind === 'shelf' ? { ...d, label: UNASSIGNED } : d
                )
          }
          onPick={(choice) => pick(choice.container, choice.label)}
          loading="your Games"
          empty={
            subject?.type === 'crawler'
              ? 'A crawler goes only into a Game you run. Start one with “+ New Game”.'
              : 'You are in no Game to move it to. Start one with “+ New Game”, or join one from an invite link.'
          }
        />
      </div>
    </ModalShell>
  )
}
