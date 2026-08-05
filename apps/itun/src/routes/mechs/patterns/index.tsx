import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeading } from 'component-lib'
import { PatternList } from '../../../components/mech/Pattern/PatternList'

export const Route = createFileRoute('/mechs/patterns/')({
  component: MechPatternsPage,
})

function MechPatternsPage() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto max-w-5xl p-6 flex flex-col gap-6">
      <div>
        <PageHeading className="w-fit">Mech Patterns</PageHeading>
        <p className="font-body text-sm text-wk-muted mt-1">
          Saved mech templates. Instantiate one to create a fresh mech with the same chassis,
          systems, modules, and cargo.
        </p>
      </div>

      <PatternList
        onInstantiated={() => {
          void navigate({ to: '/' })
        }}
      />
    </main>
  )
}
