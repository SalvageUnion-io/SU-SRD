import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { CrewPatterns } from '../../build/mech/Pattern/CrewPatterns'
import { PatternList } from '../../build/mech/Pattern/PatternList'
import { ChapterBand, PageShell, Text } from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { areaTitle } from '../../lib/pageTitle'
import { mechsCopy } from '../../messages/routes-mechs'

export const Route = createFileRoute('/patterns/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Mech Patterns') }] }),
  component: MechPatternsPage,
})

function MechPatternsPage() {
  const navigate = useNavigate()

  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand tone="mech" measure={PAGE_MEASURE}>
          {mechsCopy('mechPatterns')}
        </ChapterBand>
      }
    >
      <Text variant="note">{mechsCopy('aPatternKeepsAChassis')}</Text>
      <PatternList
        onInstantiated={() => {
          void navigate({ to: '/' })
        }}
      />
      <CrewPatterns />
    </PageShell>
  )
}
