import { createRootRoute, Outlet } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Btn, EntityHrefProvider, Toaster } from 'suref-react'
import { queryClient } from '../lib/queryClient'
import { itunEntityHref } from '../lib/entityHref'
import { GameDataReady } from '../components/shared/GameDataReady'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
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
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-[6px] border-[1.5px] border-ink bg-paper p-6 text-center sm:p-8">
        <h1 className="font-cond text-xl font-bold uppercase tracking-[0.04em] text-ink">
          Something went wrong
        </h1>
        <p className="font-body text-sm text-wk-muted">
          The app hit an unexpected error. Your saved data is stored locally and is not affected.
        </p>
        {import.meta.env.DEV && (
          <pre className="max-w-full overflow-auto rounded-[3px] border-[1.5px] border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
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

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntityHrefProvider value={itunEntityHref}>
        <GameDataReady>
          <Outlet />
        </GameDataReady>
        <Toaster />
        <BackupNudgeToast />
      </EntityHrefProvider>
    </QueryClientProvider>
  )
}
