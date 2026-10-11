import { createFileRoute } from '@tanstack/react-router'
import { Roster } from '../components/roster/Roster'
import { pageTitle } from '../lib/pageTitle'
import { setActiveContainer } from '../stores/activeContainerStore'

/**
 * `/games/$gameId` — a Game's own page (issue 1255): its crew, its panels and the
 * invite link, at an address you can bookmark and share. It used to pick the
 * Game and redirect to `/`, so every Game shared one URL with the shelf.
 *
 * The page is the hub showing that Game. Loading the route makes it the active
 * container, which is also where anything built from here goes
 * (`entityStore`'s create). The Discord bot's game links (`gameUrl`), the
 * read-only sheet's way back to "the crew" (`SheetView`) and the Dashboard's
 * Game link all land here.
 *
 * Membership is not checked here — `games.get` answers a Game you are not in
 * with an explanation and a way back to Shelves.
 *
 * Picked only on a real navigation, never a preload, so hovering a link
 * cannot change what the hub shows.
 *
 * The trailing `_` on `games_` keeps this route out of `/games`'s layout, whose
 * `beforeLoad` redirects.
 */
export const Route = createFileRoute('/games_/$gameId')({
  head: () => ({ meta: [{ title: pageTitle('Game') }] }),
  beforeLoad: ({ params, preload }) => {
    if (!preload) setActiveContainer({ kind: 'game', gameId: params.gameId })
  },
  component: Roster,
})
