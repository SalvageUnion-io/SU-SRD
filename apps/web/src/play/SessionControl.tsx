/**
 * The group session's control (play.md §10; glossary 10): the table runner's
 * **Start group session** and **End group session** as a button on the board,
 * the Mediator's bar and the Game's band alike. Ending asks first
 * (`useEndSession`), since it tells the whole table. Start carries one line
 * under it saying what starting does (glossary 10).
 */

import type { CSSProperties } from 'react'
import { useId } from 'react'
import { Button, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { useEndSession } from './useEndSession'
import type { GameSession } from './useGameSession'

/** Start, over the line that says what starting does (MD4-03). */
const START = {
  alignItems: 'flex-start',
  display: 'inline-flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  maxWidth: '15rem',
} satisfies CSSProperties

const START_HINT = {
  color: 'inherit',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  lineHeight: 1.3,
} satisfies CSSProperties

export function SessionControl({ session }: { session: GameSession | null }) {
  const end = useEndSession(session)
  const hintId = useId()
  if (session === null) return null
  const blocked = !session.canWrite || session.pending
  return (
    <>
      {session.live ? (
        <Button variant="ink" size="compact" disabled={blocked} onClick={end.ask}>
          {playCopy('endGroupSession')}
        </Button>
      ) : (
        <span style={START}>
          <Button
            variant="ink"
            size="compact"
            disabled={blocked}
            aria-describedby={hintId}
            onClick={() => void session.start()}
          >
            {playCopy('startGroupSession')}
          </Button>
          <span id={hintId} style={START_HINT}>
            {playCopy('startGroupSessionHint')}
          </span>
        </span>
      )}
      {end.dialog}
    </>
  )
}
