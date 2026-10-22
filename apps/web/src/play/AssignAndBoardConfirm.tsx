/**
 * AssignAndBoardConfirm — the confirm before an unassigned spare is assigned
 * to the player and boarded (ADR-007; `boardMenu.model.ts`), wherever Board is
 * offered: the Mount row and the Situation switch.
 */

import { ConfirmDialog } from '../components/index'
import { playCopy } from '../messages/play'
import type { BoardOption } from './boardMenu.model'
import type { Play } from './situation.model'

export function AssignAndBoardConfirm({
  play,
  assigning,
  onClose,
}: {
  play: Play
  /** The spare to assign, or null while the confirm is closed. */
  assigning: BoardOption | null
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open={assigning !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={playCopy('assignAndBoard')}
      body={
        assigning === null
          ? ''
          : `${assigning.name} is an unassigned spare. Assign it to yourself to edit it in this Game, then board it. Boarding doesn’t pair it with ${play.pilot?.name ?? 'your Pilot'}.`
      }
      confirmLabel={
        assigning === null
          ? playCopy('assignAndBoard')
          : playCopy('assignAndBoard2', { name: assigning.name })
      }
      onConfirm={() => {
        if (assigning !== null) play.assignAndBoard(assigning)
        onClose()
      }}
    />
  )
}
