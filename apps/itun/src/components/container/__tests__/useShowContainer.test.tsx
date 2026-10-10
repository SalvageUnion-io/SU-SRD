import { afterAll, describe, expect, test } from 'bun:test'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Container } from '../../../lib/container'
import { containerHref } from '../../../lib/container'
import { getActiveContainer, setActiveContainer } from '../../../stores/activeContainerStore'
import { useShowContainer } from '../useShowContainer'

/**
 * Where a container is shown (issue 1255): Shelves at `/`, a Game at its own
 * `/games/$gameId`. With a router, showing one is navigating there; with none
 * (a component test, a story) it falls back to picking it in the store.
 */

afterAll(() => setActiveContainer({ kind: 'shelf' }))

function Show({ container }: { container: Container }) {
  const show = useShowContainer()
  return (
    <button type="button" onClick={() => show(container)}>
      Show
    </button>
  )
}

/** A two-page router in memory, starting wherever `at` says. */
function routerFor(container: Container, at: string) {
  const root = createRootRoute({ component: Outlet })
  const page = () => <Show container={container} />
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: page }),
    createRoute({ getParentRoute: () => root, path: '/games/$gameId', component: page }),
  ])
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [at] }) })
}

async function press(container: Container, at: string): Promise<string> {
  const router = routerFor(container, at)
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Show' }))
  })
  return router.state.location.pathname
}

describe('useShowContainer', () => {
  test('a Game opens at its own address', async () => {
    expect(await press({ kind: 'game', gameId: 'g1' }, '/')).toBe('/games/g1')
  })

  test('the shelf opens at Shelves', async () => {
    expect(await press({ kind: 'shelf' }, '/games/g1')).toBe('/')
  })

  test('with no router, it picks the container in the store', () => {
    setActiveContainer({ kind: 'shelf' })
    render(<Show container={{ kind: 'game', gameId: 'g9' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g9' })
  })

  test('the href and the navigation agree', () => {
    expect(containerHref({ kind: 'game', gameId: 'g1' })).toBe('/games/g1')
    expect(containerHref({ kind: 'shelf' })).toBe('/')
  })
})
