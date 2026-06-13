import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PatternList } from '../../../components/mech/Pattern/PatternList'

export const Route = createFileRoute('/mechs/patterns/')({
  component: MechPatternsPage,
})

function MechPatternsPage() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto max-w-6xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mech Patterns</h1>
        <p className="text-sm text-muted-foreground mt-1">
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
