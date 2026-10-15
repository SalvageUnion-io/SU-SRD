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
import { preloadScriptFont } from './lib/scriptFont'
import { APP_BASE } from './lib/site'
import { registerServiceWorker } from './lib/sw/register'
import { installSoftUpdate, newBuild } from './lib/sw/softUpdate'
import { routeTree } from './routeTree.gen'
import { setEntityBackendAuthState } from './stores/entityBackend'

const router = createRouter({
  routeTree,
  // The Cantina at salvageunion.io/build (ADR-048, lib/site.ts). Routes and links stay root-relative; the router adds it.
  basepath: APP_BASE,
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

// Browser error reporting to the Worker, production builds only.
initBrowserObservability()

// Installed BEFORE render, because the failure it recovers from — a lazy chunk
// whose build no longer exists on the server — can be thrown by the very first
// route the router resolves. See `installChunkRecovery` in observability/browser.
installChunkRecovery()

// Until `ConnectionProvider` reports, nobody knows yet whether there is a
// session, so the stores treat the account's rows as on their way: a route
// opened at boot waits for them (stores/rowArrival.ts) rather than rendering
// an empty roster that fills a moment later.
setEntityBackendAuthState({ signedIn: false, online: navigator.onLine, authSettled: false })

// The front door's quote face, asked for now so it is in hand before the quote
// paints rather than swapped in under it (lib/scriptFont.ts).
preloadScriptFont(window.location.pathname, APP_BASE, document.fonts)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

// The error hooks are how a render crash gets reported: an error a boundary
// catches never reaches the window's `error` event, which is all the reporter hears.
createRoot(rootEl, reactRootErrorHandlers).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

// The one service-worker registration: `virtual:pwa-register`, handed to
// lib/sw/register.ts. `registerType: 'prompt'` (vite.config.ts) means a new
// worker installs and then waits rather than claiming this page mid-session.
// A breaking deploy's build floor reloads an open tab at once
// (lib/connection/buildFloor.ts); a compatible one waits for its next page
// change (lib/sw/softUpdate.ts).
registerServiceWorker(registerSW, {
  // This module IS the entry chunk, so its URL carries this build's content
  // hash — which is what the server's current shell is compared against.
  entryChunk: new URL(import.meta.url).pathname,
  onNewBuild: newBuild.markLive,
})

// A compatible new build is picked up at the next page change, as a full load
// of that page (lib/sw/softUpdate.ts). Nothing reloads under the player.
installSoftUpdate(router)
