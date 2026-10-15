import { createFileRoute } from '@tanstack/react-router'
import { SHELF } from 'cantina-domain/container'
import { Roster } from '../components/roster/Roster'
import { pageTitle } from '../lib/pageTitle'
import { setActiveContainer } from '../stores/activeContainerStore'

/**
 * `/` — Shelves: everything you keep, Games too. A Game has its own
 * address (`/games/$gameId`), so
 * this one always means the shelf: loading it makes the shelf the active
 * container, and anything built from here goes onto it. Signed out it is the
 * front door.
 *
 * Never on a preload, so hovering the Shelves link cannot change what a Game
 * page you are still on shows.
 */
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: pageTitle() }] }),
  beforeLoad: ({ preload }) => {
    if (!preload) setActiveContainer(SHELF)
  },
  component: IndexPage,
})

function IndexPage() {
  return <Roster />
}
