import { createFileRoute } from '@tanstack/react-router'
import { Roster } from '../components/roster/Roster'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return <Roster />
}
