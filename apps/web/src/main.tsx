import { registerSW } from 'virtual:pwa-register'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FRONT_DOOR_ATTRIBUTE, FRONT_DOOR_SCHEMAS } from './build/roster/frontDoorData'
import { RouteErrorComponent } from './components/shared/RouteErrors'
import { RouteNotFound, RoutePending } from './components/shared/RouteFallbacks'
import { APP_BASE, APP_REWRITE } from './lib/appBase'
import {
  initBrowserObservability,
  installChunkRecovery,
  reactRootErrorHandlers,
} from './lib/observability'
import { preloadScriptFont, SCRIPT_FONT_VARIABLE } from './lib/scriptFont'
import { registerServiceWorker } from './lib/sw/register'
import { installSoftUpdate, newBuild } from './lib/sw/softUpdate'
import { preloadGameData } from './lib/useGameData'
import { setSyncStatus } from './replica/sync'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  // The app at salvageunion.io/build, and Play at /play (ADR-048, ADR-062,
  // lib/appBase.ts). Routes and links stay root-relative; the rewrite puts each
  // on its path.
  rewrite: APP_REWRITE,
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
// route the router resolves. See `installChunkRecovery` in lib/browserObservability.ts.
installChunkRecovery()

// Until `SyncProvider` reports, nobody knows yet whether there is a session,
// so the account's rows are on their way: a route opened at boot waits for
// them (`replica.untilArrived`) rather than rendering an empty roster that
// fills a moment later.
setSyncStatus('syncing')

// The front door's quote face, asked for now so it is in hand before the quote
// paints rather than swapped in under it (lib/scriptFont.ts).
preloadScriptFont(
  window.location.pathname,
  APP_BASE,
  document.fonts,
  getComputedStyle(document.documentElement).getPropertyValue(SCRIPT_FONT_VARIABLE).trim()
)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

// The error hooks are how a render crash gets reported: an error a boundary
// catches never reaches the window's `error` event, which is all the reporter hears.
const renderApp = (root: HTMLElement) =>
  createRoot(root, reactRootErrorHandlers).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )

// Opening on the front door the shell already shows (`FRONT_DOOR_ATTRIBUTE`),
// the first render, which replaces it, waits until the live one can draw in
// its place: its schemas and its route. Sooner, the root's own waits would
// swap the page for a spinner. A failure renders anyway: the gates retry.
if (document.documentElement.hasAttribute(FRONT_DOOR_ATTRIBUTE)) {
  void Promise.allSettled([preloadGameData(FRONT_DOOR_SCHEMAS, 'full'), router.load()]).then(() =>
    renderApp(rootEl)
  )
} else {
  renderApp(rootEl)
}

// The one service-worker registration: `virtual:pwa-register`, handed to
// lib/sw/register.ts. `registerType: 'prompt'` (astro.config.ts) means a new
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
