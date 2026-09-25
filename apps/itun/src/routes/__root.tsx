import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppHeader, EntityHrefProvider, Toaster } from 'component-lib'
import { useState } from 'react'
import { AccountStrip } from '../components/account/AccountStrip'
import { LegacyLocalData } from '../components/account/LegacyLocalData'
import { ShelfSync } from '../components/account/ShelfSync'
import { TestAuthBridge } from '../components/account/TestAuthBridge'
import { AnonymousWorkPromoter, UnsavedWorkBanner } from '../components/account/UnsavedWorkBanner'
import { AppConvexProvider } from '../components/shared/AppConvexProvider'
import { AppLink } from '../components/shared/AppLink'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { NotConnectedBanner } from '../components/shared/NotConnectedBanner'
import { RootErrorComponent } from '../components/shared/RouteErrors'
import { itunEntityHref } from '../lib/entityHref'
import { queryClient } from '../lib/queryClient'
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
      <QueryClientProvider client={queryClient}>
        <EntityHrefProvider value={itunEntityHref}>
          {/* The shared brand header renders on EVERY route — including the live
            sheet (/sheet/*) and snapshot (/s/*) play surfaces, which sit below
            it and keep their own sticky control bar. It renders ONE level above
            the game-data gate (a sibling of GameDataReady, not a child) — see
            GameDataReady.tsx's doc comment: brand chrome touches no reference
            data, so it paints immediately instead of sitting behind the full
            preload. */}
          <NotConnectedBanner />
          {/* The account gate (ADR-034 decision 1). Both live here, above the
              game-data gate, because they are facts about the SESSION rather
              than about any route: work that will not survive the tab is worth
              saying on every screen, and the promoter has to outlive the banner
              — signing in unmounts the banner at exactly the moment the
              promotion needs to run. */}
          <UnsavedWorkBanner />
          <AnonymousWorkPromoter />
          {/* The other half of the same gate (ADR-035): a browser holding a
              pre-account roster. Signed out it says so and offers both doors;
              signed in it moves those rows into the account by itself. Root, not
              the Account screen — it is a fact about the browser, and its
              predecessor went unseen for living on a page nobody had to open. */}
          <LegacyLocalData />
          {/* Fills the local cache from the server of record. Renders nothing;
              mounted here because a roster is needed on every route, not only
              the one that happens to list it. */}
          <ShelfSync />
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
      </QueryClientProvider>
    </AppConvexProvider>
  )
}
