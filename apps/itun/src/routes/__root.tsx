import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppHeader, EntityHrefProvider, Toaster } from 'component-lib'
import { useState } from 'react'
import { AccountReconciler } from '../components/account/AccountReconciler'
import { AccountStrip } from '../components/account/AccountStrip'
import { TestAuthBridge } from '../components/account/TestAuthBridge'
import { AppConvexProvider } from '../components/shared/AppConvexProvider'
import { AppLink } from '../components/shared/AppLink'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { NotConnectedBanner } from '../components/shared/NotConnectedBanner'
import { RootErrorComponent } from '../components/shared/RouteErrors'
import { itunEntityHref } from '../lib/entityHref'
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
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

function RootComponent() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <AppConvexProvider>
      <EntityHrefProvider value={itunEntityHref}>
        {/* The shared brand header renders on EVERY route — including the live
          sheet (/sheet/*) and snapshot (/s/*) play surfaces, which sit below
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
        <AppHeader
          onSearchClick={() => setSearchOpen(true)}
          LinkComponent={AppLink}
          utilityRow={<AccountStrip />}
        />
        <GameDataReady>
          <Outlet />
          {/* Mounted on every route (inside the game-data gate, so search()
            is always safe) so the Cmd/Ctrl+K shortcut works everywhere,
            alongside the always-present AppHeader search trigger. */}
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </GameDataReady>
        <Toaster />
        <BackupNudgeToast />
      </EntityHrefProvider>
    </AppConvexProvider>
  )
}
