import { afterEach, expect } from 'bun:test'
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
