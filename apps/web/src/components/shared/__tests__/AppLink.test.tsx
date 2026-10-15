import { describe, expect, test } from 'bun:test'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { APP_BASE, appPath } from '../../../lib/appBase'
import { SiteLink } from '../AppLink'

/** A router under the app's base, as `main.tsx` makes it, drawing `links` on its one route. */
function underRouter(links: ReactNode) {
  const root = createRootRoute({ component: Outlet })
  const home = createRoute({ getParentRoute: () => root, path: '/', component: () => links })
  const starter = createRoute({ getParentRoute: () => root, path: '/starter' })
  const router = createRouter({
    routeTree: root.addChildren([home, starter]),
    basepath: APP_BASE,
    history: createMemoryHistory({ initialEntries: [appPath('/')] }),
  })
  return <RouterProvider router={router} />
}

describe('SiteLink', () => {
  test('routes a path under the base; any other page is a plain anchor, query kept', async () => {
    render(
      underRouter(
        <>
          <SiteLink href={appPath('/starter/')}>Starter Set</SiteLink>
          <SiteLink href="/search/?q=mule">Search</SiteLink>
        </>
      )
    )
    const starter = await screen.findByRole('link', { name: 'Starter Set' })
    expect(starter.getAttribute('href')).toBe(appPath('/starter'))
    expect(screen.getByRole('link', { name: 'Search' }).getAttribute('href')).toBe(
      '/search/?q=mule'
    )
  })
})
