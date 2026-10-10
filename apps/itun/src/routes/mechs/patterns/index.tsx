import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChapterBand } from 'component-lib'
import { CrewPatterns } from '../../../components/mech/Pattern/CrewPatterns'
import { PatternList } from '../../../components/mech/Pattern/PatternList'
import { pageTitle } from '../../../lib/pageTitle'

export const Route = createFileRoute('/mechs/patterns/')({
  head: () => ({ meta: [{ title: pageTitle('Mech Patterns') }] }),
  component: MechPatternsPage,
})

function MechPatternsPage() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto max-w-5xl p-6 flex flex-col gap-6">
      <div>
        <ChapterBand tone="mech">Mech Patterns</ChapterBand>
        <p className="font-body text-sm text-wk-muted mt-1">
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
