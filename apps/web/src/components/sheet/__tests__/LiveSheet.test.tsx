/**
 * Tests for the LiveSheet shell (the binding):
 * - condense = sticky bar + MiniStat strip, fade-in driven by an
 *   IntersectionObserver threshold with aria-hidden + pointer-events gating
 * - syncStats overlays derived values onto strip items by key
 *
 * (The entity-grid primitive tests live with the shared component:
 * src/components EntityGrid.test.tsx.)
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { must } from '../../__tests__/must'
import { EntitySurfaceProvider } from '../../index'
import { LiveSheet } from '../LiveSheet'

const ENGINEER = { label: 'Class', name: 'Engineer' }

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

/** The sticky bar. The name is also the chapter band's h1, below it. */
function bar() {
  // By selector: at rest the bar is `visibility: hidden`, out of the role tree.
  return within(must(document.querySelector<HTMLElement>('section[aria-label="Sheet controls"]')))
}

function stripWrapper(): HTMLElement {
  // The condensed block wraps the name stamp and the live readouts — empty at
  // rest, filled and faded in once the hero scrolls out of view.
  return must(
    document.querySelector<HTMLElement>('section[aria-label="Sheet controls"] [data-sheet-strip]')
  )
}

// The KIND PILL is gone from the bar (and from the props): the gutter wordmark
// (PILOT / MECH / CRAWLER, running up the page margin) names the sheet's kind
// permanently, and repeating it in the condensed bar said the same word twice
// on one screen. These tests pin the NAME stamp alone, and that no kind label
// is rendered in the bar.
describe('LiveSheet — landmarks', () => {
  test('the sheet is the page’s one main, and its sticky bar is no second banner', () => {
    renderShell()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.getByRole('main').contains(stripWrapper())).toBe(true)
  })
})

describe('LiveSheet — no bar at rest', () => {
  test('there is no back link, and the bar takes no room until the band scrolls away', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: /back to/i })).toBeNull()
    const section = must(
      document.querySelector<HTMLElement>('section[aria-label="Sheet controls"]')
    )
    expect(section.style.visibility).toBe('hidden')
    expect(section.style.position).toBe('absolute')
    expect(must(section.parentElement).style.height).toBe('0px')
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    expect(section.style.visibility).toBe('visible')
  })
})

describe('LiveSheet — condensed identity (name stamp)', () => {
  test('the name is not in the bar at rest — it lives in the poster below', () => {
    renderShell()
    // The condense block mounts its contents only once the hero scrolls out of
    // view, so the hero h1 is the one copy of the name on the page.
    expect(bar().queryByText('Mara Vex')).toBeNull()
    expect(stripWrapper().getAttribute('aria-hidden')).toBe('true')
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
    expect(bar().getByText('Mara Vex').closest('[aria-hidden="false"]')).not.toBeNull()
  })
})

describe('LiveSheet — the chapter band (board 10)', () => {
  test('the name is the band’s h1 (its kind for screen readers) and its detail', () => {
    renderShell({ kindDetail: ENGINEER })
    const title = screen.getByRole('heading', { level: 1, name: 'Mara Vex (Pilot)' })
    const band = within(must(title.closest<HTMLElement>('.su-chapter-band')))
    // The kind is never stamped (EDL E9).
    expect(band.queryByText('pilot')).toBeNull()
    // What it is built as is a label-first chip: `CLASS | Engineer`.
    const chip = must(band.getByText('Engineer').closest('.su-stat-cell'))
    expect(chip.textContent).toBe('ClassEngineer')
  })

  test('a resolved detail opens and Peeks the entity it names', () => {
    const engineer = must(SalvageUnionReference.Classes.getByName('Engineer'))
    const entityRef = toEntityModel(engineer).ref
    const openPage = mock((_: EntityRef) => undefined)
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        <LiveSheet
          variant="pilot"
          name="Mara Vex"
          renderBody={() => null}
          kindDetail={{ label: 'Class', name: 'Engineer', entityRef }}
        />
      </EntitySurfaceProvider>
    )
    const chip = screen.getByRole('button', { name: 'Class: Engineer' })
    expect(chip.getAttribute('data-peek')).toBe(`classes:${engineer.id}`)
    fireEvent.click(chip)
    expect(openPage).toHaveBeenCalledTimes(1)
  })

  test('a detail that only repeats the name is not stamped', () => {
    renderShell({ name: 'Scrapper', kindDetail: { label: 'Class', name: 'Scrapper' } })
    const title = screen.getByRole('heading', { level: 1, name: 'Scrapper (Pilot)' })
    const band = must(title.closest<HTMLElement>('.su-chapter-band'))
    expect(within(band).getAllByText('Scrapper')).toHaveLength(1)
  })

  test('the band’s controls sit in its top-right corner, above the name', () => {
    renderShell({
      band: { actions: <button type="button">Make a copy</button> },
      actions: <button type="button">Share</button>,
    })
    const corner = must(document.querySelector<HTMLElement>('.su-chapter-band__corner'))
    expect(within(corner).getByRole('button', { name: 'Make a copy' })).toBeTruthy()
    expect(within(corner).getByRole('button', { name: 'Share' })).toBeTruthy()
    const title = screen.getByRole('heading', { level: 1, name: 'Mara Vex (Pilot)' })
    expect(title.compareDocumentPosition(corner) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  test('nothing shows between the Union bar and the band: the band takes back the sentinel’s 1px', () => {
    renderShell()
    const band = must(document.querySelector<HTMLElement>('.su-chapter-band'))
    const sentinel = must(band.previousElementSibling as HTMLElement | null)
    expect(sentinel.style.height).toBe('1px')
    expect(sentinel.style.marginBottom).toBe('-1px')
  })

  test('a sheet with no controls has no corner', () => {
    renderShell()
    expect(document.querySelector('.su-chapter-band__corner')).toBeNull()
  })

  test('the stamp and the phone switch follow the name, and nothing is in the bar at rest', () => {
    renderShell({
      kindDetail: ENGINEER,
      actions: <button type="button">Share</button>,
      segments: [
        { key: 'pilot', label: 'Pilot', name: 'Mara Vex', href: '/sheet/pilot/p', active: true },
        { key: 'mech', label: 'Mech', name: 'Iron Jaw', href: '/sheet/mech/m', active: false },
      ],
    })
    const title = screen.getByRole('heading', { level: 1, name: 'Mara Vex (Pilot)' })
    expect(bar().queryByRole('button', { name: 'Share' })).toBeNull()
    expect(bar().queryByRole('navigation', { name: 'Assigned sheets' })).toBeNull()
    const after = (el: Element) =>
      (title.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(after(screen.getByRole('navigation', { name: 'Assigned sheets' }))).toBe(true)
    expect(after(screen.getByText('Engineer'))).toBe(true)
    expect(must(title.closest('.su-chapter-band')).getAttribute('data-aside')).toBe('notch')
  })
})

describe('LiveSheet — the condensed bar’s linked units', () => {
  test('each other unit is its named Token, linking to its sheet', () => {
    renderShell({
      segments: [
        { key: 'pilot', label: 'Pilot', name: 'Mara Vex', href: '/sheet/pilot/p', active: true },
        { key: 'mech', label: 'Mech', name: 'Iron Jaw', href: '/sheet/mech/m', active: false },
      ],
    })
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    const link = bar().getByRole('link', { name: 'View Iron Jaw' })
    expect(link.getAttribute('href')).toContain('/sheet/mech/m')
    expect(link.classList.contains('su-entity-token')).toBe(true)
    // The sheet being read is not linked from its own bar.
    expect(bar().queryByRole('link', { name: 'View Mara Vex' })).toBeNull()
  })

  test('the condensed name wraps rather than cutting to "…" (E18)', () => {
    renderShell()
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    const stamp = bar().getByText('Mara Vex')
    expect(stamp.style.textOverflow).toBe('')
    expect(stamp.style.whiteSpace).toBe('normal')
  })
})

describe('LiveSheet — condense strip gating (S11)', () => {
  test('resting state: strip is aria-hidden with pointer-events disabled', () => {
    renderShell()
    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.style.pointerEvents).toBe('none')
    expect(wrapper.style.opacity).toBe('0')
  })

  test('hero scrolled out: strip fades in, aria-hidden lifts, pointer events return', () => {
    renderShell()
    expect(observerCallbacks.length).toBe(1)

    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })

    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('false')
    expect(wrapper.style.pointerEvents).toBe('')
    expect(wrapper.style.opacity).toBe('1')
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
    expect(bar().queryByText('Mara Vex')).toBeNull()
  })

  test('the strip transitions opacity for the CSS fade', () => {
    renderShell()
    expect(stripWrapper().style.transitionProperty).toContain('opacity')
    expect(stripWrapper().style.transitionDuration).toBe('150ms')
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
    expect(container.querySelector('.su-sheet--pilot')).toBeTruthy()
  })

  test('mobilePriority:false strip items fold below sm', () => {
    renderShell({
      strip: [
        { key: 'sp', label: 'SP', stat: 'sp', value: 5, max: 8 },
        { key: 'ep', label: 'EP', stat: 'ep', value: 3, max: 4, mobilePriority: false },
      ],
    })
    act(() => {
      must(observerCallbacks[0])([ioEntry(false)], observerStub)
    })
    // Priority readout always visible; non-priority carries the fold class
    // (`.su-sheet-live-stat-fold`: hidden, inline-flex from sm). It rides the
    // outer stat cell (the value text's parent).
    const fold = 'su-sheet-live-stat-fold'
    expect(must(screen.getByText('5/8').parentElement).classList.contains(fold)).toBe(false)
    expect(must(screen.getByText('3/4').parentElement).classList.contains(fold)).toBe(true)
  })
})
