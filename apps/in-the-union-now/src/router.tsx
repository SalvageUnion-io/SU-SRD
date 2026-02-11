import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/queryClient'

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
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
