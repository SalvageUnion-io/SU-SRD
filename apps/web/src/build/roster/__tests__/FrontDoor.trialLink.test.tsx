/**
 * SB7-01: every "Try a round in Play" opened a 404. The button handed the
 * app's router link an address that already began with the base, and the
 * router's rewrite (`APP_REWRITE`) added it again: /build/build/pilots/…/play.
 * Rendered under the app's own router and surface link, the trial's address
 * holds the base once.
 */

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
import { cockpitPath } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { EntitySurfaceProvider } from '../../../components/entity/EntitySurface'
import { AppLink } from '../../../components/shared/AppLink'
import { APP_BASE, APP_REWRITE, appPath } from '../../../lib/appBase'
import { STARTER_ROSTERS } from '../../../lib/starterSet/starterTemplates'
import { playTrialCopy } from '../../../messages/play-trial'
import { SIGNED_OUT, SyncContext } from '../../../replica/syncContext'
import { MakeACopy } from '../../starterSet/MakeACopy'
import { FrontDoor } from '../FrontDoor'

/** The app's router as `main.tsx` makes it (the rewrite, no basepath), drawing `page`. */
function underAppRouter(page: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <EntitySurfaceProvider value={{ linkAs: AppLink }}>
        <Outlet />
      </EntitySurfaceProvider>
    ),
  })
  const home = createRoute({ getParentRoute: () => root, path: '/', component: () => page })
  const play = createRoute({ getParentRoute: () => root, path: '/pilots/$id/play' })
  const router = createRouter({
    routeTree: root.addChildren([home, play]),
    rewrite: APP_REWRITE,
    history: createMemoryHistory({ initialEntries: [appPath('/')] }),
  })
  return (
    <SyncContext.Provider value={SIGNED_OUT}>
      <RouterProvider router={router} />
    </SyncContext.Provider>
  )
}

const pilot = STARTER_ROSTERS[0]?.pilots[0]?.id ?? ''

async function trialHref(): Promise<string | null> {
  const link = await screen.findByRole('link', { name: playTrialCopy('tryARound') })
  return link.getAttribute('href')
}

describe('Try a round in Play', () => {
  test('Play’s front door links the trial under the base once', async () => {
    render(underAppRouter(<FrontDoor area="play" steps={null} />))
    const href = await trialHref()
    expect(href).toBe(appPath(cockpitPath(pilot)))
    expect(href?.split(APP_BASE).length).toBe(2)
  })

  test('a Starter pilot’s sheet links the trial under the base once', async () => {
    render(underAppRouter(<MakeACopy kind="pilot" templateId={pilot} name="Starter" />))
    const href = await trialHref()
    expect(href).toBe(appPath(cockpitPath(pilot)))
    expect(href?.split(APP_BASE).length).toBe(2)
  })
})
