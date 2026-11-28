/**
 * End my turn, the next stop after the actions on hand (r8 A7): while it is
 * this pilot's turn, a keyboard player finishing an action reaches it in one
 * Tab, never twenty Shift+Tabs back to the strip. The strip keeps its own
 * (`GameNotices`); both end the same turn.
 */

import { Button } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import { useSync } from '../replica/syncContext'
import { useTableAct } from '../replica/useTable'
import { focusTheActions } from './tableNoticesDom.model'
import { useScene } from './useScene'

const STOP = { display: 'flex', justifyContent: 'flex-end' } as const

export function PlayEndTurnStop({ gameId, pilotId }: { gameId: string; pilotId: string }) {
  const { canWrite } = useSync()
  const scene = useScene(gameId)
  const endTurn = useServerAction(useTableAct('scenes.endTurn', gameId), {
    failure: playCopy('turnDidNotEnd'),
    toastId: 'table-end-turn',
  })
  if (scene.upNow !== pilotId) return null
  return (
    <div style={STOP}>
      <Button
        variant="primary"
        size="compact"
        data-end-turn=""
        disabled={!canWrite || endTurn.pending}
        onClick={() =>
          void endTurn.run({}).then((result) => {
            if (result.ok) focusTheActions()
          })
        }
      >
        {playCopy('endMyTurn')}
      </Button>
    </div>
  )
}
