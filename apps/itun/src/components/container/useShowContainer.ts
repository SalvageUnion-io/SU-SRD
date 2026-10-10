import { useRouter } from '@tanstack/react-router'
import type { Container } from '../../lib/container'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'

/**
 * Go to where a container is shown: Shelves at `/`, or the Game's own page at
 * `/games/$gameId` (issue 1255). The route picks the container as it loads
 * (`routes/index.tsx`, `routes/games_.$gameId.tsx`), so navigating is the whole
 * of choosing what the hub shows.
 *
 * With no router mounted (a component test, a story), it picks the container
 * in the store instead, the way `AppLink` degrades to a plain anchor: the same
 * choice, without an address to show it at.
 */
export function useShowContainer(): (container: Container) => void {
  const router = useRouter({ warn: false })
  return (container) => {
    if (!router) {
      setActiveContainer(container)
      return
    }
    if (container.kind === 'game') {
      void router.navigate({ to: '/games/$gameId', params: { gameId: container.gameId } })
    } else {
      void router.navigate({ to: '/' })
    }
  }
}

/**
 * Back to where you came from: the active container's page. A build started on
 * a Game's page was made in that Game (`entityStore`'s create), so finishing or
 * cancelling it goes back to that Game, not to Shelves.
 */
export function useReturnToContainer(): () => void {
  const showContainer = useShowContainer()
  return () => showContainer(getActiveContainer())
}
