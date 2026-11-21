/**
 * Ending the group session asks first, since it tells the whole table
 * (play.md §10): `ask` opens the confirm, `dialog` is mounted once.
 */

import { useState } from 'react'
import { ConfirmDialog } from '../components/app'
import { playCopy } from '../messages/play'
import type { GameSession } from './useGameSession'

/** End the session, after a confirm: `ask` opens it, `dialog` is mounted once. */
export function useEndSession(session: GameSession | null) {
  const [asking, setAsking] = useState(false)
  return {
    ask: () => setAsking(true),
    dialog:
      session === null ? null : (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={playCopy('endGroupSessionTitle')}
          body={playCopy('endGroupSessionBody')}
          confirmLabel={playCopy('endGroupSession')}
          cancelLabel={playCopy('keepPlaying')}
          onConfirm={() => {
            session.end()
            setAsking(false)
          }}
        />
      ),
  }
}
