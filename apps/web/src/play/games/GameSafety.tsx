/**
 * GameSafety — "Safety" on a Game's own page (Core Book pp.12-13): the Stop
 * Sign. The section's head shows it from here too. Showing it posts to the
 * Game's bound Discord channel whenever one is bound; there is no opt-in.
 */

import { SlabSection, Text } from '../../components/index'
import { playSafetyCopy } from '../../messages/play-safety'
import { StopSignButton } from '../StopSign'
import type { StopSign } from '../useStopSign'
import { HUB_BODY } from './hubStyles.model'

export function GameSafety({ sign }: { sign: StopSign | null }) {
  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="safety-heading"
      title={playSafetyCopy('safety')}
      actions={<StopSignButton sign={sign} />}
    >
      <Text variant="note">{playSafetyCopy('stopSignMeans')}</Text>
    </SlabSection>
  )
}
