import { useState } from 'react'
import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Btn, EntityHrefProvider, Toaster } from 'suref-react'
import { queryClient } from '../lib/queryClient'
import { itunEntityHref } from '../lib/entityHref'
import { AppHeader } from '../components/shared/AppHeader'
import { GameDataReady } from '../components/shared/GameDataReady'
import { GlobalSearch } from '../components/shared/GlobalSearch'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
// Self-hosted Barlow superfamily (mirrors suref-web) — keeps fonts on-origin so
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
 * offers a recovery affordance. Mirrors suref-web's IslandErrorBoundary UX.
 */
function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-[6px] border-chrome border-ink bg-paper p-6 text-center sm:p-8">
        <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
          Something went wrong
        </h1>
        <p className="font-body text-sm text-wk-muted">
          The app hit an unexpected error. Your saved data is stored locally and is not affected.
        </p>
        {import.meta.env.DEV && (
          <pre className="max-w-full overflow-auto rounded-[3px] border-chrome border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
            {error.message}
          </pre>
        )}
        <Btn variant="primary" onClick={() => window.location.reload()}>
          Reload app
        </Btn>
      </div>
    </main>
  )
}

/**
 * Brand chrome is suppressed on the edge-to-edge play surfaces: live sheets
 * (/sheet/*) carry their own sticky bar (a global header would double-stack),
 * and shared snapshots (/s/*) are the same read-only sheet surface, kept
 * chrome-light for recipients.
 */
function useShowAppHeader(): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return !pathname.startsWith('/sheet/') && !pathname.startsWith('/s/')
}

function RootComponent() {
  const showAppHeader = useShowAppHeader()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <EntityHrefProvider value={itunEntityHref}>
        {/* AppHeader renders ONE level above the game-data gate (a sibling of
            GameDataReady, not a child of it) — see GameDataReady.tsx's doc
            comment for why: brand chrome touches no reference data, so it
            paints immediately instead of sitting behind the full preload. */}
        {showAppHeader && <AppHeader onSearchClick={() => setSearchOpen(true)} />}
        <GameDataReady>
          <Outlet />
          {/* Mounted on every route (inside the game-data gate, so search()
              is always safe) — the Cmd/Ctrl+K shortcut works on live sheets
              and snapshots too, where the AppHeader trigger is suppressed. */}
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </GameDataReady>
        <Toaster />
        <BackupNudgeToast />
      </EntityHrefProvider>
    </QueryClientProvider>
  )
}
