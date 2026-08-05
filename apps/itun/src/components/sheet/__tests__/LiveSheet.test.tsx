/**
 * Tests for the LiveSheet shell (plan 4.1, S11 binding):
 * - condense = sticky bar + MiniStat strip, fade-in driven by an
 *   IntersectionObserver threshold with aria-hidden + pointer-events gating
 * - syncStats overlays derived values onto strip items by key
 *
 * (The entity-grid primitive tests live with the shared component:
 * component-lib EntityGrid.test.tsx.)
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import { must } from '../../__tests__/must'
import { LiveSheet } from '../LiveSheet'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// IntersectionObserver mock — happy-dom has no IO; capture the callback so a
// test can drive the hero in/out of view.
// ---------------------------------------------------------------------------

let observerCallbacks: IntersectionObserverCallback[] = []

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin = '0px'
  readonly scrollMargin = '0px'
  readonly thresholds: ReadonlyArray<number> = []
  constructor(cb: IntersectionObserverCallback) {
    observerCallbacks.push(cb)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

/** Inert observer instance handed to callbacks as their second argument. */
const observerStub: IntersectionObserver = {
  root: null,
  rootMargin: '0px',
  scrollMargin: '0px',
  thresholds: [],
  observe: () => {},
  unobserve: () => {},
  disconnect: () => {},
  takeRecords: () => [],
}

/** The component only reads `isIntersecting` — single narrowing assertion. */
function ioEntry(isIntersecting: boolean): IntersectionObserverEntry {
  return { isIntersecting } as IntersectionObserverEntry
}

beforeEach(() => {
  observerCallbacks = []
  globalThis.IntersectionObserver = MockIntersectionObserver
})

function renderShell(props: Partial<Parameters<typeof LiveSheet>[0]> = {}) {
  return render(
    <LiveSheet
      variant="pilot"
      name="Mara Vex"
      strip={[
        { key: 'hp', label: 'HP', stat: 'hp', value: 7, max: 10 },
        { key: 'cargo', label: 'Hold', stat: 'cargo', value: 0, max: 6 },
      ]}
      back={{ href: '/', label: 'Roster' }}
      renderBody={() => (
        <>
          {/* The body owns the identity band — the shell has no hero slot. */}
          <section aria-label="hero">Hero</section>
          <div>Body</div>
        </>
      )}
      {...props}
    />
  )
}

function stripWrapper(): HTMLElement {
  // The condensed block wraps the name stamp and the live readouts — hidden at
  // rest, fading in together once the hero scrolls out of view (Option A: the
  // resting bar is slim, back + actions only). Find it via the name stamp.
  return screen.getByText('Mara Vex').parentElement as HTMLElement
}

// The KIND PILL is gone from the bar (and from the props): the gutter wordmark
// (PILOT / MECH / CRAWLER, running up the page margin) names the sheet's kind
// permanently, and repeating it in the condensed bar said the same word twice
// on one screen. These tests pin the NAME stamp alone, and that no kind label
// is rendered in the bar.
describe('LiveSheet — condensed identity (name stamp)', () => {
  test('the name is hidden at rest — it lives in the poster below', () => {
    renderShell()
    // It sits inside the condense block, aria-hidden until the hero scrolls out
    // of view, so the resting bar stays slim (only back + actions show).
    expect(screen.getByText('Mara Vex').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  test('the kind pill is never rendered in the bar', () => {
    renderShell()
    expect(screen.queryByText('Pilot')).toBeNull()
  })

  test('the name fades in once the hero scrolls out of view', () => {
    renderShell()
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    expect(screen.getByText('Mara Vex').closest('[aria-hidden="false"]')).not.toBeNull()
  })

  test('the name is not rendered when condense is disabled', () => {
    renderShell({ condense: false })
    expect(screen.queryByText('Mara Vex')).toBeNull()
  })
})

describe('LiveSheet — condense strip gating (S11)', () => {
  test('resting state: strip is aria-hidden with pointer-events disabled', () => {
    renderShell()
    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.className).toContain('pointer-events-none')
    expect(wrapper.className).toContain('opacity-0')
  })

  test('hero scrolled out: strip fades in, aria-hidden lifts, pointer events return', () => {
    renderShell()
    expect(observerCallbacks.length).toBe(1)

    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })

    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('false')
    expect(wrapper.className).not.toContain('pointer-events-none')
    expect(wrapper.className).toContain('opacity-100')
    // Live stat readout present in the condensed bar. The kind pill is NOT —
    // the gutter wordmark carries the sheet's kind now.
    expect(screen.getByText('7/10')).toBeTruthy()
    expect(screen.queryByText('Pilot')).toBeNull()
  })

  test('hero back in view: strip hides again', () => {
    renderShell()
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    act(() => {
      must(observerCallbacks[0])([ioEntry(true)], observerStub)
    })
    expect(stripWrapper().getAttribute('aria-hidden')).toBe('true')
  })

  test('condense=false renders no condensed block and observes nothing', () => {
    renderShell({ condense: false })
    // The whole condensed block (name + strip) is gated on condense.
    expect(screen.queryByText('Mara Vex')).toBeNull()
    expect(screen.queryByLabelText('HP 7 of 10')).toBeNull()
    expect(observerCallbacks.length).toBe(0)
  })

  test('transition classes are present for the CSS fade', () => {
    renderShell()
    expect(stripWrapper().className).toContain('transition-')
  })
})

describe('LiveSheet — strip values and syncStats', () => {
  test('syncStats overlays derived values onto matching strip keys', () => {
    renderShell({ syncStats: { cargo: 4 } })
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    expect(screen.getByText('4/6')).toBeTruthy()
    // Non-overlaid keys keep their own value
    expect(screen.getByText('7/10')).toBeTruthy()
  })

  test('variant sets the sheet tone class on the root', () => {
    const { container } = renderShell()
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
  })

  test('mobilePriority:false strip items fold below sm (U-5)', () => {
    renderShell({
      strip: [
        { key: 'sp', label: 'SP', stat: 'sp', value: 5, max: 8 },
        { key: 'ep', label: 'EP', stat: 'ep', value: 3, max: 4, mobilePriority: false },
      ],
    })
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    // Priority readout always visible; non-priority carries the fold classes.
    // The fold class rides the outer stat cell (the value text's parent).
    // Use classList tokens, not substring — the cell also carries `overflow-hidden`.
    expect(must(screen.getByText('5/8').parentElement).classList.contains('hidden')).toBe(false)
    const folded = must(screen.getByText('3/4').parentElement)
    expect(folded.classList.contains('hidden')).toBe(true)
    expect(folded.classList.contains('sm:inline-flex')).toBe(true)
  })
})
