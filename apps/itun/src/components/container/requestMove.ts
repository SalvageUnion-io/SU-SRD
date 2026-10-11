/**
 * The one decision every container move makes before it moves anything: does
 * it ask first? Shared by the live sheet's "In:" select
 * (`MoveToContainerControl`) and a shelf item's "Move to a Game…" (Shelves,
 * board S1), so the two cannot disagree about when a move confirms.
 *
 *  - **Out of a Game** — to the shelf or on to another Game — always asks
 *    (`leaveGame`): it takes the build off a roster the table was reading.
 *  - **Into a Game** asks only when it clears an assignment (`enterGame`,
 *    naming each, ADR-037); otherwise it moves at once.
 *
 * A confirmed move runs bare (`move`), because the dialog shows its own
 * failure; an unasked one runs through `moveNow`, which owns its own pending and
 * error state.
 */

import type { Container } from '../../lib/container'
import { sameContainer } from '../../lib/container'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { assignmentsClearedByMove } from '../../lib/links/clearedByMove'
import { useEntityStore } from '../../stores/entityStore'
import type { AssignableType } from '../../stores/types'
import type { Confirm } from '../shared/useConfirm'

export function requestMove(args: {
  entityType: AssignableType
  entityId: string
  name: string
  current: Container
  next: Container
  /** A Game's name as the reader knows it, or null when it is not one of theirs. */
  gameName: (gameId: string) => string | null
  confirm: Confirm
  /** The move itself, for a confirm to run. */
  move: (next: Container) => Promise<void>
  /** The move with its own pending and error handling, for a move that does not ask. */
  moveNow: (next: Container) => void
}): void {
  const { entityType, entityId, name, current, next, gameName, confirm } = args
  if (current.kind === 'game' && !sameContainer(current, next)) {
    confirm({
      ...ROW_ACTION_COPY.leaveGame({
        name,
        kind: entityType,
        from: gameName(current.gameId),
        to: next.kind === 'shelf' ? next : { kind: 'game', name: gameName(next.gameId) },
      }),
      onConfirm: () => args.move(next),
    })
    return
  }
  const cleared =
    next.kind === 'game'
      ? assignmentsClearedByMove(
          useEntityStore.getState(),
          { type: entityType, id: entityId },
          next
        )
      : []
  if (next.kind === 'shelf' || cleared.length === 0) {
    args.moveNow(next)
    return
  }
  confirm({
    ...ROW_ACTION_COPY.enterGame({
      name,
      kind: entityType,
      game: gameName(next.gameId),
      cleared,
    }),
    onConfirm: () => args.move(next),
  })
}
