import type { useConfirm } from '../../components/shared/useConfirm'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { useGamesQuery } from '../../replica/roomCalls'
import type { MoveSubject } from '../shelves/MoveToGameDialog'
import { MoveToGameDialog } from '../shelves/MoveToGameDialog'

/**
 * "Move to a Game…" over a sheet: the Bay's dialog, with the server's list of
 * your Games. Mounted only while it is open and the session is live, so the
 * Games call has a server to ask; a chunk of its own, fetched then.
 */
export function SheetMove({
  subject,
  onClose,
  confirm,
}: {
  subject: MoveSubject
  onClose: () => void
  confirm: ReturnType<typeof useConfirm>['confirm']
}) {
  const games = useGamesQuery('games.listMine', {}) as readonly MoveTargetGame[] | undefined
  return <MoveToGameDialog subject={subject} onClose={onClose} games={games} confirm={confirm} />
}
