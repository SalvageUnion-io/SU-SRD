/**
 * The group session's control (play.md §10; glossary 10): the table runner's
 * **Start group session** and **End group session** as a button on the board,
 * the Mediator's bar and the Game's band alike. Ending asks first
 * (`useEndSession`), since it tells the whole table.
 */

import { Button } from '../components/index'
import { playCopy } from '../messages/play'
import { useEndSession } from './useEndSession'
import type { GameSession } from './useGameSession'

export function SessionControl({ session }: { session: GameSession | null }) {
  const end = useEndSession(session)
  if (session === null) return null
  const blocked = !session.canWrite || session.pending
  return (
    <>
      {session.live ? (
        <Button variant="ink" size="compact" disabled={blocked} onClick={end.ask}>
          {playCopy('endGroupSession')}
        </Button>
      ) : (
        <Button
          variant="ink"
          size="compact"
          disabled={blocked}
          onClick={() => void session.start()}
        >
          {playCopy('startGroupSession')}
        </Button>
      )}
      {end.dialog}
    </>
  )
}
