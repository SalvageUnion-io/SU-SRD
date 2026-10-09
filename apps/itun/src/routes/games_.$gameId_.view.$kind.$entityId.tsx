import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Kept so `/games/…/view/…` links already posted in Discord keep opening;
 * nothing mints this URL. The trailing `_` on both `games_` and `$gameId_`
 * keeps it out of `/games` and `/games/$gameId`, whose own redirects would
 * otherwise run first.
 */
export const Route = createFileRoute('/games_/$gameId_/view/$kind/$entityId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/sheet/$kind/$id',
      params: { kind: params.kind, id: params.entityId },
      replace: true,
    })
  },
})
