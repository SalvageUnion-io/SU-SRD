import { createFileRoute } from '@tanstack/react-router'
import { SectionSeparator } from 'suref-react'
import { PatternSection } from '../../components/patterns/PatternSection'
import { PilotSection } from '../../components/pilots/PilotSection'

export const Route = createFileRoute('/_authenticated/')({
  component: Dashboard,
})

function DashboardSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-su-grey-light/30 p-4">
      <div className="mb-2">
        <SectionSeparator label={title} fontSize="text-sm" />
      </div>
      <p className="text-sm text-su-grey-dark">{description}</p>
    </div>
  )
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-su-orange">Dashboard</h1>
        <p className="mt-1 text-sm text-su-grey-dark">Your Salvage Union roster at a glance.</p>
      </div>

      <PilotSection />

      <PatternSection />

      <DashboardSection
        title="Crawlers"
        description="No crawlers yet. Crawlers are created when starting a campaign."
      />
    </div>
  )
}
