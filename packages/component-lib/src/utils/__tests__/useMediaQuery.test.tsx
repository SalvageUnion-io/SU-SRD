import { afterEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useMediaQuery } from '../useMediaQuery'

const realMatchMedia = window.matchMedia

/** A matchMedia whose answer the test flips, firing every listener. */
function fakeViewport(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia
  return {
    listeners,
    set(next: boolean) {
      matches = next
      for (const fn of listeners) fn()
    },
  }
}

function Probe({ fallback }: { fallback?: boolean }) {
  const wide = useMediaQuery('(min-width: 80rem)', fallback)
  return <span data-testid="probe">{wide ? 'wide' : 'narrow'}</span>
}

afterEach(() => {
  window.matchMedia = realMatchMedia
})

describe('useMediaQuery', () => {
  test('reads the live query and re-renders when it flips', () => {
    const viewport = fakeViewport(false)
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('narrow')
    act(() => viewport.set(true))
    expect(screen.getByTestId('probe').textContent).toBe('wide')
  })

  test('unsubscribes on unmount', () => {
    const viewport = fakeViewport(true)
    const { unmount } = render(<Probe />)
    expect(viewport.listeners.size).toBe(1)
    unmount()
    expect(viewport.listeners.size).toBe(0)
  })

  test('with no matchMedia it answers the fallback: true by default, or the one given', () => {
    // @ts-expect-error — an engine with no matchMedia
    window.matchMedia = undefined
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('wide')
    unmount()
    render(<Probe fallback={false} />)
    expect(screen.getByTestId('probe').textContent).toBe('narrow')
  })

  test('the server render is the fallback, whatever the viewport says', () => {
    fakeViewport(true)
    expect(renderToString(<Probe fallback={false} />)).toContain('narrow')
    expect(renderToString(<Probe />)).toContain('wide')
  })
})
