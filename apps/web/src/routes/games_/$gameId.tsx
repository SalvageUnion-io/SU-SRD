import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { Roster } from '../../build/roster/Roster'
import { areaTitle } from '../../lib/pageTitle'
import { setActiveContainer } from '../../stores/activeContainerStore'

/**
 * `/games/$gameId` — a Game's own page: its crew, its panels and the
 * invite link, at an address you can bookmark and share: no Game shares its
 * URL with the shelf.
 *
 * The page is the hub showing that Game. Loading the route makes it the active
 * container, which is also where anything built from here goes
 * (`entityStore`'s create). The Discord bot's game links (`gameUrl`), the
 * read-only sheet's way back to "the crew" (`SheetView`) and Play's Game
 * link all land here.
 *
 * Membership is not checked here — `games.get` answers a Game you are not in
 * with an explanation and a way back to Shelves.
 *
 * Picked only on a real navigation, never a preload, so hovering a link
 * cannot change what the hub shows.
 */
export const Route = createFileRoute('/games_/$gameId')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Game') }] }),
  beforeLoad: ({ params, preload }) => {
    if (!preload) setActiveContainer({ kind: 'game', gameId: params.gameId })
  },
  component: Roster,
})
