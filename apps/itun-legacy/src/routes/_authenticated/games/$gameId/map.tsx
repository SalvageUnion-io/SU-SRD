import { createFileRoute } from '@tanstack/react-router'
import { MapPage } from '../../../../components/map/MapPage'

export const Route = createFileRoute('/_authenticated/games/$gameId/map')({
  component: GameMapRoute,
})

function GameMapRoute() {
  const { gameId } = Route.useParams()
  return <MapPage gameId={gameId} />
}
