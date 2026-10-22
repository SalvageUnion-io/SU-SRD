/**
 * GamePage — the body of `/play/games/$gameId` (ADR-052 §5): who may open a
 * Game's page, in each storage mode.
 *
 *  - **Signed out:** sign in first. There are no Games signed out.
 *  - **Connecting:** a beat while the session settles.
 *  - **Connected:** the page (`GameHub`), which `games.get` answers live: a
 *    Game you are not in reads as an explanation.
 *  - **Disconnected:** a Game is the server's record, so its page waits for the
 *    connection; your own builds stay in the Training Bay.
 */

import '../../styles/play/play.css'
import { PRODUCT } from 'game-domain/product'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import { useConnection } from '../../lib/connection/connectionContext'
import { playGamesCopy } from '../../messages/play-games'
import { PlayRefusal } from '../PlayRefusal'
import { GameHub } from './GameHub'

export function GamePage({ gameId }: { gameId: string }) {
  const { mode } = useConnection()
  if (mode === 'solo') {
    return (
      <PlayRefusal
        title={playGamesCopy('signInToOpenThis')}
        body={playGamesCopy('aGameLivesOnIts')}
        link={{ href: '/sign-in', label: playGamesCopy('signInWithDiscord'), back: false }}
      />
    )
  }
  if (mode === 'connecting') return <RoutePending label={playGamesCopy('yourSession')} />
  if (mode === 'disconnected') {
    return (
      <PlayRefusal
        title={playGamesCopy('thisGameOpensOnceYou')}
        body={playGamesCopy('aGamesPageIsRead', { build: PRODUCT.build })}
        link={{ href: '/', label: PRODUCT.build }}
      />
    )
  }
  // Remount per Game, so one table's busy and error state never shows on the next.
  return <GameHub key={gameId} gameId={gameId} />
}
