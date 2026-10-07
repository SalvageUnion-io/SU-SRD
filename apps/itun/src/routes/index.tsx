import { createFileRoute } from '@tanstack/react-router'
import { Roster } from '../components/roster/Roster'
import { pageTitle } from '../lib/pageTitle'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: pageTitle() }] }),
  component: IndexPage,
})

function IndexPage() {
  return <Roster />
}
