import { render as rtlRender, type RenderResult } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { system } from '../theme'
import type { ReactNode } from 'react'

// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'

/**
 * Create a new QueryClient for each test with retries disabled
 * Following TanStack Query testing best practices:
 * https://tkdodo.eu/blog/testing-react-query
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

let currentQueryClient: QueryClient | null = null

export function render(ui: ReactNode): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient()
  currentQueryClient = queryClient

  const rootRoute = createRootRoute({
    component: () => <>{ui}</>,
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({
      initialEntries: ['/'],
    }),
  })

  const result = rtlRender(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={system}>
        <div style={{ width: '1920px', minWidth: '1920px' }}>
          <RouterProvider router={router} />
        </div>
      </ChakraProvider>
    </QueryClientProvider>
  )

  return { ...result, queryClient }
}

/**
 * Get the current QueryClient from the last render call
 * Useful for test helpers that need to manipulate cache
 */
export function getCurrentQueryClient(): QueryClient | null {
  return currentQueryClient
}
