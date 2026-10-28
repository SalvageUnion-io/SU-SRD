import { createRootRoute, HeadContent, Outlet, useRouterState } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { useLayoutEffect } from 'react'
import { AccountHintSync } from '../build/account/AccountHintSync'
import {
  HeaderActions,
  HeaderDrawerAccount,
  HeaderGames,
  HeaderMobileActions,
} from '../build/account/HeaderAccount'
import { TestAuthBridge } from '../build/account/TestAuthBridge'
import { expectsFrontDoor, FRONT_DOOR_SCHEMAS, isRosterRoute } from '../build/roster/frontDoorData'
import type { EntitySurfaceValue } from '../components/index'
import { EntitySurfaceProvider, ToasterMount } from '../components/index'
import { MobileSearchIsland } from '../components/islands/MobileSearchIsland'
import { SearchIsland } from '../components/islands/SearchIsland'
import { AppLink } from '../components/shared/AppLink'
import { EntityPageHost } from '../components/shared/EntityPageHost'
import { GameDataReady } from '../components/shared/GameDataReady'
import { RootErrorComponent } from '../components/shared/RouteErrors'
import { SiteFooter } from '../components/shared/SiteFooter'
import { UnionBarSlots } from '../components/shared/UnionBarSlots'
import { areaTitle } from '../lib/pageTitle'
import { preloadGameData } from '../lib/useGameData'
import { ReplicaSync } from '../replica/ReplicaSync'
import { SyncProvider } from '../replica/SyncProvider'
import { BAR_HIDDEN_ATTRIBUTE, hidesUnionBar } from '../shell/unionSlots'
import '../styles/app.css'

// The root boundary is the last resort — every other route gets its own via
// the router's `defaultErrorComponent` (main.tsx). See RouteErrors.tsx.
/**
 * The entity SURFACE every form in the app reads (entity display language §2):
 * a link-mode form navigates through the router (`AppLink`), and the app
 * applies the rules the data encodes, so rules-bearing prose wears the AUTO
 * stamp (`appliesRules`, ADR-029 §6). The Page opener is `EntityPageHost`'s,
 * below (the detail dialog).
 */
/*
 * The dataset's preload, started at MODULE SCOPE, not on first render.
 *
 * Started inside a component, the fetch would wait for React to boot, mount
 * the provider tree and render down to the gate: dead time on the critical
 * path. At module scope it overlaps React's bootstrap and the rest of the
 * entry chunk. These are the gates' own keyed preloads (`useGameData`), so the
 * gates and the bar's controls (`useGameData().ready`) share these requests.
 *
 * A visitor opening the front door gets its few schemas first, then the rest:
 * on a slow line the whole dataset would share the bandwidth the front door's
 * first paint waits on.
 */
void (expectsFrontDoor(window.location.pathname)
  ? preloadGameData(FRONT_DOOR_SCHEMAS, 'full').then(() => preloadGameData('all', 'full'))
  : preloadGameData('all', 'full'))

const ENTITY_SURFACE: Partial<EntitySurfaceValue> = { linkAs: AppLink, appliesRules: true }

export const Route = createRootRoute({
  // The default tab title, the front door's; a page with its own sets it in its route's `head`.
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build) }] }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

/**
 * The Union bar's slots, filled (`UnionBarSlots`; the bar is the shell's). Its
 * own component because its account slots read the connection, which only
 * exists inside `SyncProvider`.
 */
function RootHeader({ pathname, barHidden }: { pathname: string; barHidden: boolean }) {
  return (
    <UnionBarSlots
      pathname={pathname}
      barHidden={barHidden}
      games={<HeaderGames pathname={pathname} />}
      search={<SearchIsland />}
      mobileSearch={<MobileSearchIsland />}
      drawerSearch={<SearchIsland />}
      actions={<HeaderActions />}
      mobileActions={<HeaderMobileActions />}
      drawerExtra={(close) => <HeaderDrawerAccount close={close} pathname={pathname} />}
    />
  )
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // A Play screen draws its own bar at every width, so it has no masthead
  // (ADR-051 §2): the Play bar, at every width. Nor
  // does a link preview's render surface. The shell's bar is hidden there.
  const barHidden = hidesUnionBar(pathname)
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute(BAR_HIDDEN_ATTRIBUTE, barHidden)
  }, [barHidden])

  // A link preview's render surface (`/og/*`) is a picture, not a
  // page: the card alone, with the Worker and the reference data and none of the
  // chrome, banners or account flow a screenshot must not catch.
  if (pathname.startsWith('/og/')) {
    return (
      <SyncProvider>
        <GameDataReady>
          <Outlet />
        </GameDataReady>
      </SyncProvider>
    )
  }

  return (
    <SyncProvider>
      <HeadContent />
      <EntitySurfaceProvider value={ENTITY_SURFACE}>
        {/* The Union bar is the shell's, above this root, with the skip
            link (WCAG 2.4.1) ahead of it. `RootHeader` fills its slots on every
            route that shows it. */}
        {/* The account gate (ADR-034 decision 1) and the migration off
            device-only storage (ADR-035), as one surface: says what is at
            stake while signed out, moves it into the account on sign-in, and
            keeps the local cache filled from the server. Above the game-data
            gate because it is a fact about the SESSION and the BROWSER, not
            about any route — and it must stay mounted across the sign-in flip,
            which is exactly when its work runs. */}
        <ReplicaSync />
        {/* Who is signed in, left for the SRD's bar to show. */}
        <AccountHintSync />
        {/* A test seam, compiled out of production builds — see its header. */}
        <TestAuthBridge />
        {/* The Page opener every Mention and Tag reads, and the app's Peek. */}
        <EntityPageHost>
          <RootHeader pathname={pathname} barHidden={barHidden} />
          {/* The skip link's target. A plain block, not a `<main>`: each
                route draws its own `<main>` (a sheet's is `LiveSheet`), and a
                second one would be a duplicate landmark. `tabIndex={-1}` makes
                following the link move focus here, not just the scroll, so the
                next Tab lands in the content instead of back in the bar. */}
          <div id="main-content" tabIndex={-1}>
            <GameDataReady schemas={isRosterRoute(pathname) ? FRONT_DOOR_SCHEMAS : 'all'}>
              <Outlet />
            </GameDataReady>
          </div>
          {/* The shared page foot, on every route that draws the Union
                bar: a Play screen fills the viewport and the page never
                scrolls (play.md), so it has no foot, as it has no masthead. */}
          {barHidden ? null : <SiteFooter />}
        </EntityPageHost>
        <ToasterMount />
      </EntitySurfaceProvider>
    </SyncProvider>
  )
}
