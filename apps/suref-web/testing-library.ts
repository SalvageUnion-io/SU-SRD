import { afterEach, expect } from 'bun:test'
import { cleanup } from '@testing-library/react'
import { act } from 'react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Suppress known act() warnings from router/UI library internal components
// These are async transitions that don't affect test correctness
const originalError = console.error
const knownComponents = [
  'Transitioner',
  'MatchesInner',
  'TabsRoot',
  'SheetInput',
  'PilotLiveSheet',
]

console.error = (...args: unknown[]) => {
  // Convert all arguments to a single string to check for patterns
  const fullMessage = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')

  // Suppress act() warnings for known internal components
  // The warning format is: "An update to ComponentName inside a test was not wrapped in act(...)"
  const isActWarning =
    fullMessage.includes('was not wrapped in act') ||
    fullMessage.includes('inside a test was not wrapped in act')

  if (isActWarning && knownComponents.some((comp) => fullMessage.includes(comp))) {
    return
  }

  originalError.apply(console, args)
}

// Clean up after each test, wrapping in act() to flush pending updates
afterEach(async () => {
  await act(async () => {
    cleanup()
  })
})
