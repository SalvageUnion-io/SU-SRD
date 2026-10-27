import { ChapterBand, PageShell, Text } from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { useHomebrewModeration } from '../../lib/sharing/reads'
import { buildHomebrewCopy } from '../../messages/build-homebrew'
import { HomebrewModeration } from './HomebrewModeration'

export function HomebrewModerationScreen() {
  const queue = useHomebrewModeration()
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
