import { createFileRoute, useParams } from '@tanstack/react-router'

import { JoinScreen } from '../../components/games/JoinScreen'

export const Route = createFileRoute('/join/$code')({
  component: JoinRoute,
})

function JoinRoute() {
  const { code } = useParams({ from: '/join/$code' })
  return <JoinScreen code={code} />
}
