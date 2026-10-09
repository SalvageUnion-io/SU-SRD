import { registerSW } from 'virtual:pwa-register'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteErrorComponent } from './components/shared/RouteErrors'
import { RouteNotFound, RoutePending } from './components/shared/RouteFallbacks'
import {
  initBrowserObservability,
  installChunkRecovery,
  reactRootErrorHandlers,
} from './lib/observability'
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
  // hydrates.
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
// route the router resolves. See `installChunkRecovery` in observability/browser.
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

// The one service-worker registration: `virtual:pwa-register`, handed to
// lib/sw/register.ts. `registerType: 'prompt'` (vite.config.ts) means a new
// worker installs and then waits rather than claiming this page mid-session;
// the backend's build floor decides when an open tab moves onto a new build
// (lib/connection/buildFloor.ts), and it reloads through lib/sw/register.ts.
registerServiceWorker(registerSW, {
  // This module IS the entry chunk, so its URL carries this build's content
  // hash — which is what the server's current shell is compared against.
  entryChunk: new URL(import.meta.url).pathname,
})
