import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { CrewPatterns } from '../../../build/mech/Pattern/CrewPatterns'
import { PatternList } from '../../../build/mech/Pattern/PatternList'
import { ChapterBand, PageShell } from '../../../components/index'
import { color, font, fontSize } from '../../../design/tokens'
import { PAGE_MEASURE } from '../../../lib/pageMeasure'
import { areaTitle } from '../../../lib/pageTitle'
import { mechsCopy } from '../../../messages/routes-mechs'

export const Route = createFileRoute('/mechs/patterns/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Mech Patterns') }] }),
  component: MechPatternsPage,
})

const LEDE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  margin: 0,
} satisfies CSSProperties

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
      <p style={LEDE}>{mechsCopy('aPatternKeepsAChassis')}</p>
      <PatternList
        onInstantiated={() => {
          void navigate({ to: '/' })
        }}
      />
      <CrewPatterns />
    </PageShell>
  )
}
