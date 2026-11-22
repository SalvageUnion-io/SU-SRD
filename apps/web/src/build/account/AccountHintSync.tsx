import { useEffect } from 'react'
import { useMe } from '../../lib/account/accountApi'
import {
  clearAccountHint,
  lastGameAmong,
  readLastGame,
  writeAccountHint,
  writeLastGame,
} from '../../lib/accountHint'
import { localStore } from '../../lib/safeLocalStorage'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

/**
 * Keeps the account hint (`src/lib/accountHint`) the session's, so the
 * SRD's Union bar shows the same account menu as this one.
 *
 * Connected, it writes the name and avatar `useMe` answers with, and the Game
 * the home's welcome-back strip names; signed out, it clears them. Syncing and offline leave the hint as it is:
 * neither says the session ended.
 *
 * Mounted once, at the root, beside `ReplicaSync`.
 */
export function AccountHintSync() {
  const { status } = useSync()
  const me = useMe(status === 'live')

  useEffect(() => {
    if (status === 'signedOut') clearAccountHint(localStore())
  }, [status])

  useEffect(() => {
    if (me) writeAccountHint({ name: me.displayName, avatarUrl: me.avatarUrl }, localStore())
  }, [me])

  // The home's welcome-back strip names a Game on a device that has opened
  // none yet, and follows a rename (r3 I4). The listing is the one the pinned
  // notices already hold.
  const games = useGamesQuery('games.listMine', status === 'live' ? {} : 'skip')
  useEffect(() => {
    if (games === undefined) return
    const game = lastGameAmong(
      readLastGame(localStore()),
      games.map((g) => ({ id: g._id, name: g.name }))
    )
    if (game) writeLastGame(game, localStore())
  }, [games])

  return null
}
