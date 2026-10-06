import { createFileRoute, redirect } from '@tanstack/react-router'
import { setActiveContainer } from '../../stores/activeContainerStore'

/**
 * `/mediator/$gameId` was the Mediator page. Its instruments are the hub's
 * Mediator section now, shown under the Game's roster to the Game's Mediator,
 * so the old address picks that Game and lands on `/` — the same as
 * `/games/$gameId`, and for the same reason. Never on a preload.
 */
export const Route = createFileRoute('/mediator/$gameId')({
  beforeLoad: ({ params, preload }) => {
    if (!preload) setActiveContainer({ kind: 'game', gameId: params.gameId })
    throw redirect({ to: '/', replace: true })
  },
})
