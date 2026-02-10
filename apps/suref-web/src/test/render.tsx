import { render as rtlRender, type RenderResult } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
  type RouterHistory,
} from '@tanstack/react-router'
import { system } from 'suref-react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach } from 'bun:test'

// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'

let currentHistory: RouterHistory | null = null

/**
 * Cleanup function to be called after each test
 * Following TanStack Router testing best practices:
 * https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing
 */
beforeEach(() => {
  // Reset location state before each test
  window.history.replaceState(null, 'root', '/')
})

afterEach(() => {
  if (currentHistory) {
    currentHistory.destroy()
    currentHistory = null
  }
  // Note: cleanup() is handled by testing-library.ts preload with act() wrapper
})

/**
 * Render function following TanStack Router testing patterns
 * https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing
 *
 * This is an async function because router.load() returns a Promise
 * that must be awaited before the route content will render.
 *
 * Note: RTL's render automatically wraps in act() internally.
 * We don't explicitly wrap in act() to avoid React 19's stricter
 * environment checks that can cause spurious warnings.
 */
export async function render(ui: ReactNode): Promise<RenderResult> {
  const rootRoute = createRootRoute({
    component: () => <>{ui}</>,
  })

  const history = createMemoryHistory({
    initialEntries: ['/'],
  })
  currentHistory = history

  const router = createRouter({
    routeTree: rootRoute,
    history,
  })

  // Await router load - required in TanStack Router v1.157+
  // Without awaiting this, the router stays in "idle" status and doesn't render route content
  await router.load()

  // RTL's render wraps in act() internally
  const result = rtlRender(
    <ChakraProvider value={system}>
      <div style={{ width: '1920px', minWidth: '1920px' }}>
        <RouterProvider router={router} />
      </div>
    </ChakraProvider>
  )

  return result
}
