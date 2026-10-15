import { createRootRoute, HeadContent, Outlet, useRouterState } from '@tanstack/react-router'
import { useLayoutEffect, useState } from 'react'
import { AccountHintSync } from '../components/account/AccountHintSync'
import { AccountReconciler } from '../components/account/AccountReconciler'
import {
  HeaderActions,
  HeaderDrawerAccount,
  HeaderGames,
  HeaderMobileActions,
} from '../components/account/HeaderAccount'
import { TestAuthBridge } from '../components/account/TestAuthBridge'
import type { EntitySurfaceValue } from '../components/index'
import { EntityHrefProvider, EntitySurfaceProvider, Toaster } from '../components/index'
import { AppConvexProvider } from '../components/shared/AppConvexProvider'
import { AppLink } from '../components/shared/AppLink'
import { EntityPageHost } from '../components/shared/EntityPageHost'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { NotConnectedBanner } from '../components/shared/NotConnectedBanner'
import { RootErrorComponent } from '../components/shared/RouteErrors'
import { SiteFooter } from '../components/shared/SiteFooter'
import { UnionBarSlots } from '../components/shared/UnionBarSlots'
import { cantinaEntityHref } from '../lib/builderEntityHref'
import { pageTitle } from '../lib/pageTitle'
import { BAR_HIDDEN_ATTRIBUTE, hidesUnionBar } from '../shell/unionSlots'
// The tagline's script face, self-hosted like the Barlow faces in the shared base
// stylesheet: fonts stay on-origin, so the CSP needs no external host.
import '@fontsource/caveat/600.css'
import '../styles/builder.css'

// The root boundary is the last resort — every other route gets its own via
// the router's `defaultErrorComponent` (main.tsx). See RouteErrors.tsx.
/**
 * The entity SURFACE every form in the app reads (entity display language §2):
 * a link-mode form navigates through the router (`AppLink`), and the app
 * applies the rules the data encodes, so rules-bearing prose wears the AUTO
 * stamp (`appliesRules`, ADR-029 §6). The Page opener is `EntityPageHost`'s,
 * below (the detail dialog).
 */
const ENTITY_SURFACE: Partial<EntitySurfaceValue> = { linkAs: AppLink, appliesRules: true }

export const Route = createRootRoute({
  // The default tab title; a page with its own sets it in its route's `head`.
  head: () => ({ meta: [{ title: pageTitle() }] }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

/**
 * The Union bar's slots, filled (`UnionBarSlots`; the bar is the shell's). Its
 * own component because its account slots read the connection, which only
 * exists inside `AppConvexProvider`.
 */
function RootHeader({ pathname, barHidden }: { pathname: string; barHidden: boolean }) {
  // The reference search's open state, shared by its desktop and phone triggers.
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <UnionBarSlots
      pathname={pathname}
      barHidden={barHidden}
      banner={<NotConnectedBanner />}
      games={<HeaderGames pathname={pathname} />}
      search={<GlobalSearch variant="bar" open={searchOpen} onOpenChange={setSearchOpen} />}
      mobileSearch={<GlobalSearch variant="icon" open={searchOpen} onOpenChange={setSearchOpen} />}
      actions={<HeaderActions />}
      mobileActions={<HeaderMobileActions />}
      drawerExtra={(close) => <HeaderDrawerAccount close={close} />}
    />
  )
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // The Dashboard draws its own bar at every width, so it has no masthead
  // (ADR-045 §6, board D1): the canvas's rail, the phone form's ink bar. Nor
  // does a link preview's render surface. The shell's bar is hidden there.
  const barHidden = hidesUnionBar(pathname)
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute(BAR_HIDDEN_ATTRIBUTE, barHidden)
  }, [barHidden])

  // A link preview's render surface (`/og/*`) is a picture, not a
  // page: the card alone, with Convex and the reference data and none of the
  // chrome, banners or account flow a screenshot must not catch.
  if (pathname.startsWith('/og/')) {
    return (
      <AppConvexProvider>
        <GameDataReady>
          <Outlet />
        </GameDataReady>
      </AppConvexProvider>
    )
  }

  return (
    <AppConvexProvider>
      <HeadContent />
      <EntityHrefProvider value={cantinaEntityHref}>
        <EntitySurfaceProvider value={ENTITY_SURFACE}>
          {/* The Union bar is the shell's, above this root, with the skip
            link (WCAG 2.4.1) ahead of it. `RootHeader` fills the not-connected
            banner above it on every route, and its slots on every route that
            shows it. */}
          {/* The account gate (ADR-034 decision 1) and the migration off
            device-only storage (ADR-035), as one surface: says what is at
            stake while signed out, moves it into the account on sign-in, and
            keeps the local cache filled from the server. Above the game-data
            gate because it is a fact about the SESSION and the BROWSER, not
            about any route — and it must stay mounted across the sign-in flip,
            which is exactly when its work runs. */}
          <AccountReconciler />
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
              <GameDataReady>
                <Outlet />
              </GameDataReady>
            </div>
            {/* The shared page foot, on every route. */}
            <SiteFooter />
          </EntityPageHost>
          <Toaster />
        </EntitySurfaceProvider>
      </EntityHrefProvider>
    </AppConvexProvider>
  )
}
