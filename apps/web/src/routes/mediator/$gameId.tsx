/**
 * The retired Mediator Dashboard route — /mediator/:gameId
 *
 * Play replaced the Mediator Dashboard: the address now redirects to the
 * Game's Play screen (`/play/game/:gameId`), keeping its id, so a bookmark or
 * an old link lands where the Mediator runs the table now. Who may open it is
 * `PlayMediatorGate`'s question, asked live there.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/mediator/$gameId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/play/game/$gameId', params: { gameId: params.gameId }, replace: true })
  },
})
