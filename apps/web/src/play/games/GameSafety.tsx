/**
 * GameSafety — "Safety" on a Game's own page (Core Book pp.12-13): the Stop
 * Sign. The section's head shows it from here too, and the table runner
 * chooses whether showing it posts to the Game's bound Discord channel
 * (`safety.setPostToChannel`).
 */

import { SlabSection, Switch, Text } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { playSafetyCopy } from '../../messages/play-safety'
import { useSync } from '../../replica/syncContext'
import { useTableAct } from '../../replica/useTable'
import { StopSignButton } from '../StopSign'
import type { StopSign } from '../useStopSign'
import { HUB_BODY } from './hubStyles.model'

export function GameSafety({ gameId, sign }: { gameId: string; sign: StopSign | null }) {
  const setPost = useServerAction(useTableAct('safety.setPostToChannel', gameId), {
    failure: playSafetyCopy('couldNotChange'),
    toastId: 'stop-sign-post',
  })
  const { canWrite } = useSync()

  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="safety-heading"
      title={playSafetyCopy('safety')}
      actions={<StopSignButton sign={sign} label={playSafetyCopy('stopSign')} />}
    >
      <Text variant="note">{playSafetyCopy('stopSignMeans')}</Text>
      {sign?.mayManage && (
        <Switch
          checked={sign.postToChannel}
          disabled={!canWrite || setPost.pending}
          onClick={() => void setPost.run({ on: !sign.postToChannel })}
        >
          {playSafetyCopy('postToChannel')}
        </Switch>
      )}
    </SlabSection>
  )
}
