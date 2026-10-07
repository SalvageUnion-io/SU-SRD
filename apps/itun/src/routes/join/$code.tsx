import { createFileRoute, useParams } from '@tanstack/react-router'
import { JoinScreen } from '../../components/games/JoinScreen'
import { pageTitle } from '../../lib/pageTitle'

export const Route = createFileRoute('/join/$code')({
  head: () => ({ meta: [{ title: pageTitle('Join a Game') }] }),
  component: JoinRoute,
})

function JoinRoute() {
  const { code } = useParams({ from: '/join/$code' })
  return <JoinScreen code={code} />
}
