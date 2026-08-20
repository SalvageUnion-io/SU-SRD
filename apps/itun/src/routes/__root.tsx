import { QueryClientProvider } from '@tanstack/react-query'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppHeader, EntityHrefProvider, RecoveryPanel, Toaster } from 'component-lib'
import { useState } from 'react'
import { AccountStrip } from '../components/account/AccountStrip'
import { AnonymousWorkPromoter, UnsavedWorkBanner } from '../components/account/UnsavedWorkBanner'
import { AppConvexProvider } from '../components/shared/AppConvexProvider'
import { AppLink } from '../components/shared/AppLink'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { NotConnectedBanner } from '../components/shared/NotConnectedBanner'
import { BlockedUpgradeError } from '../lib/db/index'
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

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

/**
 * Top-level error boundary. Without this, a render-time exception anywhere in
 * the tree (e.g. a rejected game-data preload behind the root Suspense gate)
 * blanks the whole app. TanStack Router renders this component instead and
 * offers a recovery affordance. Mirrors srd's IslandErrorBoundary UX.
 */
function RootErrorComponent({ error }: ErrorComponentProps) {
  // A blocked IndexedDB upgrade (this site open in another tab on an older
  // build) is a distinct, self-serviceable failure — give it its own copy and
  // CTA instead of the generic "something went wrong". Match on name too, so a
  // structured clone or re-wrapped error across the router boundary still hits.
  const isBlockedUpgrade =
    error instanceof BlockedUpgradeError ||
    (error as { name?: string } | null)?.name === 'BlockedUpgradeError'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
      <RecoveryPanel
        title={isBlockedUpgrade ? 'Close the other tab' : 'Something went wrong'}
        message={
          isBlockedUpgrade
            ? 'In the Union Now is open in another browser tab running an older version, which is blocking this one from loading. Close every other In the Union Now tab, then reload. Your saved data is safe.'
            : 'The app hit an unexpected error. Your saved data is stored locally and is not affected.'
        }
        action={{
          label: isBlockedUpgrade ? 'Reload' : 'Reload app',
          onClick: () => window.location.reload(),
        }}
      >
        {import.meta.env.DEV && (
          <pre className="max-w-full overflow-auto rounded-card border-chrome border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
            {error.message}
          </pre>
        )}
      </RecoveryPanel>
    </main>
  )
}

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
