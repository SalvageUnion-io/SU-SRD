/**
 * The retired Build Game page — /games/:gameId
 *
 * A Game's page moved into Play (ADR-052 §5): the address redirects there
 * (`/play/games/:gameId`), keeping its id, so a bookmark, an old Discord card
 * or an old link lands on the Game's page.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/games_/$gameId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/play/games/$gameId', params: { gameId: params.gameId }, replace: true })
  },
})
