/**
 * The root route's chrome, mounted under a real router signed out: the skip
 * link and its target, the Union bar on every page but the Dashboard (which
 * draws its own, ADR-045 §6), the footer, the default tab title, and the bare
 * `/og/*` picture surface with none of it.
 *
 * The root's own options are reused on a fresh root route, so the app's
 * generated route tree is never touched.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'

// Module scope, before the imports below — see `convexMock.ts`. Signed out:
// the app's first paint for a visitor.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => convexMocks.restore())

const { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } =
  await import('@tanstack/react-router')
const { Route } = await import('../__root')
const { pageTitle } = await import('../../lib/pageTitle')

async function mountAt(path: string) {
  // The file route's options, typed for its own place in the generated tree.
  const root = createRootRoute(Route.options as unknown as Parameters<typeof createRootRoute>[0])
  const page = (text: string) => () => <p>{text}</p>
  const tree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: page('The roster') }),
    createRoute({
      getParentRoute: () => root,
      path: '/dashboard/$pilotId',
      component: page('The Dashboard'),
    }),
    createRoute({ getParentRoute: () => root, path: '/og/$id', component: page('The card') }),
  ])
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  setQueryAnswers({})
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  await screen.findByText(/^The (roster|Dashboard|card)$/)
}

describe('the root route', () => {
  test('a page gets the skip link, the Union bar, its content and the footer', async () => {
    await mountAt('/')
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip.getAttribute('href')).toBe('#main-content')
    const target = document.getElementById('main-content')
    expect(target?.getAttribute('tabindex')).toBe('-1')
    expect(target?.textContent).toContain('The roster')
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  test('the tab gets the default title', async () => {
    await mountAt('/')
    expect(document.title).toBe(pageTitle())
  })

  test('the Dashboard draws its own bar, so the Union bar steps aside', async () => {
    await mountAt('/dashboard/p1')
    expect(screen.getByText('The Dashboard')).toBeTruthy()
    expect(screen.queryByRole('banner')).toBeNull()
    // The rest of the chrome stays.
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  test('a link preview is the card alone: no skip link, bar or footer', async () => {
    await mountAt('/og/abc')
    expect(screen.getByText('The card')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Skip to content' })).toBeNull()
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('contentinfo')).toBeNull()
    expect(document.getElementById('main-content')).toBeNull()
  })
})
