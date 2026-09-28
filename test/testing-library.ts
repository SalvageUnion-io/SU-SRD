import { afterEach, expect } from 'bun:test'
import { format } from 'node:util'
import { cleanup, configure, act } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Reduce async timeout for faster tests (default is 1000ms)
configure({ asyncUtilTimeout: 1000 })

// Clean up after each test, wrapping in act() to flush any pending React updates
// This prevents "not wrapped in act()" warnings from async state updates in components like TabsRoot
afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  // Web-storage state (e.g. ITUN wizard drafts in sessionStorage) must not
  // leak across tests — a draft written by one test would silently restore
  // into the next test's pristine mount.
  sessionStorage.clear()
  localStorage.clear()
})

// These two React warnings fail the test that raises them rather than scroll past:
// each is a real bug — a state update that lands outside act(), or a style
// longhand mixed with its shorthand, which re-rendering can drop.
const FORBIDDEN_REACT_WARNINGS = ['not wrapped in act(', 'a style property during rerender']
const consoleError = console.error
console.error = (...args: unknown[]) => {
  const [message] = args
  if (typeof message === 'string' && FORBIDDEN_REACT_WARNINGS.some((w) => message.includes(w))) {
    throw new Error(`${format(...args)}\n(test/testing-library.ts fails the test on this warning.)`)
  }
  consoleError(...args)
}
