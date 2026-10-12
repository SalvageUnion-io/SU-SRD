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

const PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  marginInline: 'auto',
  maxWidth: '64rem',
  padding: space[24],
} satisfies CSSProperties

const LEDE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  marginTop: space[4],
} satisfies CSSProperties

function MechPatternsPage() {
  const navigate = useNavigate()

  return (
    <main style={PAGE}>
      <div>
        <ChapterBand tone="mech">Mech Patterns</ChapterBand>
        <p style={LEDE}>
          A pattern keeps a chassis and its loadout. A mech built from one starts fresh.
        </p>
      </div>

      <PatternList
        onInstantiated={() => {
          void navigate({ to: '/' })
        }}
      />
      <CrewPatterns />
    </main>
  )
}
