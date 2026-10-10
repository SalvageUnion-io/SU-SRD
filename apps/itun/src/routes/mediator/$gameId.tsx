import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/mediator/$gameId` was the Mediator page. Its instruments are the Game
 * page's Mediator section now, shown to the Game's Mediator, so the old
 * address lands on that Game's own page, `/games/$gameId`.
 */
export const Route = createFileRoute('/mediator/$gameId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/games/$gameId', params: { gameId: params.gameId }, replace: true })
  },
})
