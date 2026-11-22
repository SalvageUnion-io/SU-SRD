/**
 * Ending the group session asks first, since it tells the whole table
 * (play.md §10): `ask` opens the confirm, `dialog` is mounted once. Once it
 * has ended, whoever ended it lands on the Game's page, which leads with the
 * session's recap (r6 C1).
 */

import { gamePath } from 'game-domain/entityKinds'
import { useState } from 'react'
import { ConfirmDialog } from '../components/app'
import { useGo } from '../components/shared/useGo'
import { playCopy } from '../messages/play'
import type { GameSession } from './useGameSession'
import { useTidyUp } from './useTidyUp'

/** End the session, after a confirm: `ask` opens it, `dialog` is mounted once. */
export function useEndSession(session: GameSession | null) {
  const [asking, setAsking] = useState(false)
  const go = useGo()
  // What a running encounter leaves behind, tidied in the same press (r6 C2).
  const tidy = useTidyUp(session?.gameId ?? null)
  return {
    ask: () => {
      tidy.reset()
      setAsking(true)
    },
    dialog:
      session === null ? null : (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={playCopy('endGroupSessionTitle')}
          body={
            tidy.boxes === null ? (
              playCopy('endGroupSessionBody')
            ) : (
              <>
                {playCopy('endGroupSessionBody')}
                {tidy.boxes}
              </>
            )
          }
          confirmLabel={playCopy('endGroupSession')}
          cancelLabel={playCopy('keepPlaying')}
          onConfirm={async () => {
            await tidy.run()
            const ended = await session.end()
            setAsking(false)
            if (ended === true && session.gameId !== undefined) go(gamePath(session.gameId))
          }}
        />
      ),
  }
}
