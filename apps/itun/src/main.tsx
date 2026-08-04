import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteNotFound, RoutePending } from './components/shared/RouteFallbacks'
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

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

registerServiceWorker()
