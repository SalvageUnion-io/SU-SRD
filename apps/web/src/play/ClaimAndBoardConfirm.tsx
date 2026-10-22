/**
 * ClaimAndBoardConfirm — the confirm before an unclaimed spare is claimed and
 * boarded (ADR-007; `boardMenu.model.ts`), wherever Board is offered: the
 * Mount row and the Situation switch.
 */

import { ConfirmDialog } from '../components/index'
import { playCopy } from '../messages/play'
import type { BoardOption } from './boardMenu.model'
import type { Play } from './situation.model'

export function ClaimAndBoardConfirm({
  play,
  claiming,
  onClose,
}: {
  play: Play
  /** The spare to claim, or null while the confirm is closed. */
  claiming: BoardOption | null
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open={claiming !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={playCopy('claimAndBoard')}
      body={
        claiming === null
          ? ''
          : `${claiming.name} is an unclaimed spare. Claim it to make it yours in this Game, then board it. Boarding doesn’t assign it to ${play.pilot?.name ?? 'your Pilot'}.`
      }
      confirmLabel={
        claiming === null
          ? playCopy('claimAndBoard')
          : playCopy('claimAndBoard2', { name: claiming.name })
      }
      onConfirm={() => {
        if (claiming !== null) play.claimAndBoard(claiming)
        onClose()
      }}
    />
  )
}
