import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { ChapterBand, PageShell } from '../../../components/index'
import { CrewPatterns } from '../../../components/mech/Pattern/CrewPatterns'
import { PatternList } from '../../../components/mech/Pattern/PatternList'
import { color, font, fontSize } from '../../../design/tokens'
import { PAGE_MEASURE } from '../../../lib/pageMeasure'
import { pageTitle } from '../../../lib/pageTitle'

export const Route = createFileRoute('/mechs/patterns/')({
  head: () => ({ meta: [{ title: pageTitle('Mech Patterns') }] }),
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
          Mech Patterns
        </ChapterBand>
      }
    >
      <p style={LEDE}>
        A pattern keeps a chassis and its loadout. A mech built from one starts fresh.
      </p>
      <PatternList
        onInstantiated={() => {
          void navigate({ to: '/' })
        }}
      />
      <CrewPatterns />
    </PageShell>
  )
}
