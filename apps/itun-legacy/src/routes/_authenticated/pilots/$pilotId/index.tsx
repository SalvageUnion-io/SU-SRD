import { createFileRoute } from '@tanstack/react-router'
import { HydratedPilotDisplay } from '../../../../components/pilots/HydratedPilotDisplay'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId/')({
  component: PilotDetailPage,
})

function PilotDetailPage() {
  const { pilotId } = Route.useParams()
  return <HydratedPilotDisplay pilotId={pilotId} />
}
