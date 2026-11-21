import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { CrewPatterns } from '../../build/mech/Pattern/CrewPatterns'
import { Shelves } from '../../build/shelves/Shelves'
import { ShelvesPart } from '../../build/shelves/shelvesPart.model'
import { PageShell } from '../../components/app'
import { ChapterBand, Text } from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { areaTitle } from '../../lib/pageTitle'
import { mechsCopy } from '../../messages/routes-mechs'

export const Route = createFileRoute('/patterns/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, mechsCopy('mechPatterns')) }] }),
  component: MechPatternsPage,
})

function MechPatternsPage() {
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
      {/* The Training Bay's own Patterns shelf: its rows, menu and "+ From a Mech". */}
      <ShelvesPart.Provider value="patterns">
        <Shelves />
      </ShelvesPart.Provider>
      <CrewPatterns />
    </PageShell>
  )
}
