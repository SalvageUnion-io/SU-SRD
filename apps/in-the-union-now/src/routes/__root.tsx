import { createRootRoute, Outlet } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { EntityHrefProvider, Toaster } from 'suref-react'
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
    <div
      role="alert"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-lg font-bold">Something went wrong</h1>
      <p className="text-sm text-wk-muted">
        The app hit an unexpected error. Your saved data is stored locally and is not affected.
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => window.location.reload()}
      >
        Reload app
      </button>
    </div>
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
