import { createRouter, RouterProvider } from '@tanstack/react-router'
import { toast } from 'component-lib'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteNotFound, RoutePending } from './components/shared/RouteFallbacks'
import { installChunkRecovery } from './lib/chunkRecovery'
import { initBrowserObservability } from './lib/observability'
import { registerServiceWorker } from './lib/sw/register'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: RouteNotFound,
  defaultPendingComponent: RoutePending,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Optional, env-gated browser error tracking (no-op unless VITE_SENTRY_DSN set).
void initBrowserObservability()

// Installed BEFORE render, because the failure it recovers from — a lazy chunk
// whose build no longer exists on the server — can be thrown by the very first
// route the router resolves. See lib/chunkRecovery.ts.
installChunkRecovery()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

// `registerType: 'prompt'` (vite.config.ts) means a new worker installs and then
// waits rather than claiming this page mid-session, so the swap is ours to time.
// The toast is that timing: an update the user accepts, not one that happens to
// them while they are reading a sheet.
//
// Deliberately persistent (`duration: Infinity`) and dismissible. This fires at
// most once per installed update, and the alternative — auto-dismiss — puts the
// user back on a stale build with no way to ask for the new one.
registerServiceWorker({
  onUpdateReady: (accept) => {
    toast('A new version of ITUN is ready', {
      description: 'Reload to pick it up. Your saved data is not affected.',
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Reload', onClick: accept },
    })
  },
})
