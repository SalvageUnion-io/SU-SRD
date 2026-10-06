import { createFileRoute, redirect } from '@tanstack/react-router'
import { setActiveContainer } from '../stores/activeContainerStore'

/**
 * `/games/$gameId` — open one Game on the hub.
 *
 * It was the Game page; the hub at `/` shows a Game's crew and panels now,
 * whichever container its "Showing" select has picked. So this address picks
 * that Game, then lands on `/` (replacing the history entry). It is not only a
 * legacy URL: the Discord bot's game links (`gameUrl`) and the read-only
 * sheet's way back to "the crew" (`SheetView`) both use it, because a plain `/`
 * cannot say which Game to show.
 *
 * Membership is not checked here — the hub's `games.get` answers a Game you
 * are not in with an explanation and a way back to My Stuff.
 *
 * Picked only on a real navigation, never a preload, so hovering a link
 * cannot change what the hub shows.
 *
 * The trailing `_` on `games_` keeps this route out of `/games`'s layout, whose
 * `beforeLoad` would otherwise redirect first and drop the Game id.
 */
export const Route = createFileRoute('/games_/$gameId')({
  beforeLoad: ({ params, preload }) => {
    if (!preload) setActiveContainer({ kind: 'game', gameId: params.gameId })
    throw redirect({ to: '/', replace: true })
  },
})
