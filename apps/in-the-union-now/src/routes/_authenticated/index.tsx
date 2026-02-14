import { createFileRoute } from '@tanstack/react-router'
import { RosterView } from '../../components/Roster/RosterView'

export const Route = createFileRoute('/_authenticated/')({
  component: RosterPage,
})

function RosterPage() {
  return <RosterView />
}
