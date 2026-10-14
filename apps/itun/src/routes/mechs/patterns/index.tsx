import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChapterBand } from 'component-lib'
import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { CrewPatterns } from '../../../components/mech/Pattern/CrewPatterns'
import { PatternList } from '../../../components/mech/Pattern/PatternList'
import { pageTitle } from '../../../lib/pageTitle'

export const Route = createFileRoute('/mechs/patterns/')({
  head: () => ({ meta: [{ title: pageTitle('Mech Patterns') }] }),
  component: MechPatternsPage,
})

/** Shelves' measure, and the SRD's: the band's row and the body under it. */
const MEASURE = '75rem'

const PAGE = { backgroundColor: color.wkBg, minHeight: '100%' } satisfies CSSProperties

// Its side padding and centring are `.su-page-column`'s: the band's row padding.
const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  maxWidth: MEASURE,
  paddingBlock: `${space[20]} ${space[48]}`,
} satisfies CSSProperties

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
    <main style={PAGE}>
      <ChapterBand tone="mech" measure={MEASURE}>
        Mech Patterns
      </ChapterBand>
      <div className="su-page-column" style={BODY}>
        <p style={LEDE}>
          A pattern keeps a chassis and its loadout. A mech built from one starts fresh.
        </p>
        <PatternList
          onInstantiated={() => {
            void navigate({ to: '/' })
          }}
        />
        <CrewPatterns />
      </div>
    </main>
  )
}
