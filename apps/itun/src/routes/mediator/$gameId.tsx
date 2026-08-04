import { createFileRoute, useParams } from '@tanstack/react-router'
import { MediatorScreen } from '../../components/games/MediatorScreen'

export const Route = createFileRoute('/mediator/$gameId')({
  component: MediatorRoute,
})

function MediatorRoute() {
  const { gameId } = useParams({ from: '/mediator/$gameId' })
  return <MediatorScreen gameId={gameId} />
}
