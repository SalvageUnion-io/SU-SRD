import { createFileRoute } from '@tanstack/react-router'
import { Text } from 'suref-react'
import { User, Truck } from 'lucide-react'
import { PatternSection } from '../../components/patterns/PatternSection'

export const Route = createFileRoute('/_authenticated/')({
  component: Dashboard,
})

function DashboardSection({
  title,
  icon: Icon,
  description,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}) {
  return (
    <div className="rounded-md border border-su-grey-light/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-su-orange" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white uppercase">
          {title}
        </Text>
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

      <PatternSection />

      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardSection
          title="Pilots"
          icon={User}
          description="No pilots created yet. Create a pilot after building a mech pattern."
        />
        <DashboardSection
          title="Crawlers"
          icon={Truck}
          description="No crawlers yet. Crawlers are created when starting a campaign."
        />
      </div>
    </div>
  )
}
