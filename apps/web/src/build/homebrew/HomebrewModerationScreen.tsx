/**
 * HomebrewModerationScreen — `/admin/homebrew` (ADR-061): the site admin's
 * queue under a hatched band. Anyone else is told the page is not theirs;
 * the queue itself is never sent to them (`homebrew.moderation`).
 */

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ChapterBand, PageShell, Text } from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { buildHomebrewCopy } from '../../messages/build-homebrew'
import { HomebrewModeration } from './HomebrewModeration'

export function HomebrewModerationScreen() {
  const queue = useQuery(api.homebrew.moderation)
  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand tone="mech" userMade measure={PAGE_MEASURE}>
          {buildHomebrewCopy('moderationTitle')}
        </ChapterBand>
      }
    >
      <Text variant="hint">{buildHomebrewCopy('moderationLede')}</Text>
      {queue === null && <Text>{buildHomebrewCopy('adminsOnly')}</Text>}
      {queue && <HomebrewModeration queue={queue} />}
    </PageShell>
  )
}
