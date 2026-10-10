import { createRootRoute, HeadContent, Outlet, useRouterState } from '@tanstack/react-router'
import { CopyFeedbackProvider, EntityHrefProvider, Toaster, toast } from 'component-lib'
import { useState } from 'react'
import { AccountReconciler } from '../components/account/AccountReconciler'
import {
  HeaderActions,
  HeaderDrawerAccount,
  HeaderGames,
  HeaderMobileActions,
} from '../components/account/HeaderAccount'
import { TestAuthBridge } from '../components/account/TestAuthBridge'
import { AppConvexProvider } from '../components/shared/AppConvexProvider'
import { AppHeader } from '../components/shared/AppHeader'
import { AppLink } from '../components/shared/AppLink'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { NotConnectedBanner } from '../components/shared/NotConnectedBanner'
import { RootErrorComponent } from '../components/shared/RouteErrors'
import { useConnection } from '../lib/connection/connectionContext'
import { itunEntityHref } from '../lib/entityHref'
import { pageTitle } from '../lib/pageTitle'
// Self-hosted Barlow superfamily (mirrors srd) — keeps fonts on-origin so
// the CSP needs no external font/style host and the offline PWA renders correctly.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '../index.css'

// The root boundary is the last resort — every other route gets its own via
// the router's `defaultErrorComponent` (main.tsx). See RouteErrors.tsx.
export const Route = createRootRoute({
  // The default tab title; a page with its own sets it in its route's `head`.
  head: () => ({ meta: [{ title: pageTitle() }] }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

/** RollTable's Copy confirmation, raised on the `<Toaster />` below. */
function toastCopied() {
  toast.success('Copied', { id: 'clipboard-copy', duration: 1500 })
}

/**
 * The Union bar with ITUN's slots filled. Its own component because it reads
 * the connection, which only exists inside `AppConvexProvider`.
 */
function RootHeader({ pathname }: { pathname: string }) {
  const { mode } = useConnection()
  // The reference search's open state, shared by its desktop and phone triggers.
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <AppHeader
      LinkComponent={AppLink}
      pathname={pathname}
      games={<HeaderGames />}
      search={<GlobalSearch variant="bar" open={searchOpen} onOpenChange={setSearchOpen} />}
      mobileSearch={<GlobalSearch variant="icon" open={searchOpen} onOpenChange={setSearchOpen} />}
      actions={<HeaderActions />}
      mobileActions={<HeaderMobileActions />}
      drawerExtra={(close) => <HeaderDrawerAccount close={close} />}
      // Signed out there is no account menu, which is where a desktop keeps
      // About and Changelog — so they come back to the bar.
      aboutInBar={mode !== 'connected' && mode !== 'disconnected'}
    />
  )
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // A link preview's render surface (`/og/*`, issue 1280) is a picture, not a
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
      <EntityHrefProvider value={itunEntityHref}>
        {/* The shared brand header renders on EVERY route — including the live
          sheet (/sheet/*) and public sheet (/p/*) surfaces, which sit below
          it and keep their own sticky control bar. It renders ONE level above
          the game-data gate (a sibling of GameDataReady, not a child) — see
          GameDataReady.tsx's doc comment: brand chrome touches no reference
          data, so it paints immediately instead of sitting behind the full
          preload. */}
        <NotConnectedBanner />
        {/* The account gate (ADR-034 decision 1) and the migration off
            device-only storage (ADR-035), as one surface: says what is at
            stake while signed out, moves it into the account on sign-in, and
            keeps the local cache filled from the server. Above the game-data
            gate because it is a fact about the SESSION and the BROWSER, not
            about any route — and it must stay mounted across the sign-in flip,
            which is exactly when its work runs. */}
        <AccountReconciler />
        {/* A test seam, compiled out of production builds — see its header. */}
        <TestAuthBridge />
        <RootHeader pathname={pathname} />
        <CopyFeedbackProvider value={toastCopied}>
          <GameDataReady>
            <Outlet />
          </GameDataReady>
        </CopyFeedbackProvider>
        <Toaster />
      </EntityHrefProvider>
    </AppConvexProvider>
  )
}
