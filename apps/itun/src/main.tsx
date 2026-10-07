import { createRouter, RouterProvider } from '@tanstack/react-router'
import { toast } from 'component-lib'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteErrorComponent } from './components/shared/RouteErrors'
import { RouteNotFound, RoutePending } from './components/shared/RouteFallbacks'
import { installChunkRecovery } from './lib/chunkRecovery'
import { initBrowserObservability, reactRootErrorHandlers } from './lib/observability'
import { registerServiceWorker } from './lib/sw/register'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: RouteNotFound,
  defaultPendingComponent: RoutePending,
  // Every route gets its own error boundary, so a crash in one route replaces
  // that route's content and leaves the header to navigate away with. The root
  // route keeps its own full-page one as the last resort. See RouteErrors.tsx.
  defaultErrorComponent: RouteErrorComponent,
  // Every route is a lazy chunk (`autoCodeSplitting`, routeTree.config.ts), so a
  // hover or touchstart starts the chunk and the loader before the tap lands.
  // Loaders must therefore be safe to run early: the entity ones are idempotent
  // hydrates, and `/s/$id`, which fetches, opts out with `preload: false`.
  defaultPreload: 'intent',
  // Backing out of a sheet returns the Roster to where the player left it.
  scrollRestoration: true,
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

// The error hooks are how a render crash reaches Sentry: an error a boundary
// catches never reaches window.onerror, which is all the SDK listens to.
createRoot(rootEl, reactRootErrorHandlers).render(
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
//
// It fires only for a tab older than the server's build: navigations are
// network-first, so a page loaded after a deploy is already the new version
// and needs no prompt. See the header of lib/sw/register.ts.
registerServiceWorker({
  // This module IS the entry chunk, so its URL carries this build's content
  // hash — which is what the server's current shell is compared against.
  entryChunk: new URL(import.meta.url).pathname,
  onUpdateReady: (accept) => {
    toast('A new version of ITUN is ready', {
      description: 'Reload to pick it up. Your saved data is not affected.',
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Reload', onClick: accept },
    })
  },
})
