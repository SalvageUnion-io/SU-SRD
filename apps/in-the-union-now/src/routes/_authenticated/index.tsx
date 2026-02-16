import { createFileRoute } from '@tanstack/react-router'
import { PatternSection } from '../../components/patterns/PatternSection'
import { PilotSection } from '../../components/pilots/PilotSection'
import { GameSection } from '../../components/games/GameSection'

export const Route = createFileRoute('/_authenticated/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-su-orange">Dashboard</h1>
        <p className="mt-1 text-sm text-su-grey-dark">Your Salvage Union roster at a glance.</p>
      </div>

      <PilotSection />

      <PatternSection />

      <GameSection />
    </div>
  )
}
