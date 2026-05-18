import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/queryClient'
import { ErrorFallback } from './components/shared/ErrorFallback'
import { PendingFallback } from './components/shared/PendingFallback'

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: ErrorFallback,
    defaultPendingComponent: PendingFallback,
    context: {
      queryClient,
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
