/**
 * Tests for the LiveSheet shell (plan 4.1, S11 binding):
 * - condense = sticky bar + MiniStat strip, fade-in driven by an
 *   IntersectionObserver threshold with aria-hidden + pointer-events gating
 * - syncStats overlays derived values onto strip items by key
 * - Erow mode 'card' folds footActions/footMeta into the card foot
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'

import { LiveSheet } from '../LiveSheet'
import { Ecflow, Erow } from '../Erow'
import { must } from '../../__tests__/must'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// IntersectionObserver mock — happy-dom has no IO; capture the callback so a
// test can drive the hero in/out of view.
// ---------------------------------------------------------------------------

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void

let observerCallbacks: IOCallback[] = []

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    observerCallbacks.push(cb)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  observerCallbacks = []
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver
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
      pill={{ label: 'Pilot', tone: 'pilot' }}
      renderHero={({ heroRef }) => (
        <section ref={heroRef} aria-label="hero">
          Hero
        </section>
      )}
      renderBody={() => <div>Body</div>}
      {...props}
    />
  )
}

function stripWrapper(): HTMLElement {
  // The condensed block wraps the name stamp, kind pill, and live readouts — all
  // hidden at rest, fading in together once the hero scrolls out of view (Option
  // A: the resting bar is slim, back + actions only). Find it via the name stamp.
  return screen.getByText('Mara Vex').parentElement as HTMLElement
}

describe('LiveSheet — condensed identity (name stamp + kind pill)', () => {
  test('name and kind pill are hidden at rest — they live in the poster below', () => {
    renderShell()
    // Both sit inside the condense block, aria-hidden until the hero scrolls
    // out of view, so the resting bar stays slim (only back + actions show).
    expect(screen.getByText('Mara Vex').closest('[aria-hidden="true"]')).not.toBeNull()
    const pill = screen.getByText('Pilot')
    expect(pill.closest('[aria-hidden="true"]')).not.toBeNull()
    // One canonical badge radius — the rounded-full kindpill variant was retired.
    expect(pill.className).toContain('rounded-badge')
  })

  test('name and kind pill fade in once the hero scrolls out of view', () => {
    renderShell()
    act(() => {
      must(observerCallbacks[0])([{ isIntersecting: false }])
    })
    expect(screen.getByText('Mara Vex').closest('[aria-hidden="false"]')).not.toBeNull()
    expect(screen.getByText('Pilot')).toBeTruthy()
  })

  test('name and kind pill are not rendered when condense is disabled', () => {
    renderShell({ condense: false })
    expect(screen.queryByText('Mara Vex')).toBeNull()
    expect(screen.queryByText('Pilot')).toBeNull()
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
      must(observerCallbacks[0])([{ isIntersecting: false }])
    })

    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('false')
    expect(wrapper.className).not.toContain('pointer-events-none')
    expect(wrapper.className).toContain('opacity-100')
    // Live stat readout present in the condensed bar
    expect(screen.getByText('7/10')).toBeTruthy()
    expect(screen.getByText('Pilot')).toBeTruthy()
  })

  test('hero back in view: strip hides again', () => {
    renderShell()
    act(() => {
      must(observerCallbacks[0])([{ isIntersecting: false }])
    })
    act(() => {
      must(observerCallbacks[0])([{ isIntersecting: true }])
    })
    expect(stripWrapper().getAttribute('aria-hidden')).toBe('true')
  })

  test('condense=false renders no condensed block and observes nothing', () => {
    renderShell({ condense: false })
    // The whole condensed block (name + pill + strip) is gated on condense.
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
      must(observerCallbacks[0])([{ isIntersecting: false }])
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
      must(observerCallbacks[0])([{ isIntersecting: false }])
    })
    // Priority readout always visible; non-priority carries the fold classes.
    // The fold class rides the outer stat cell (the value text's parent).
    expect(screen.getByText('5/8').parentElement?.className).not.toContain('hidden')
    const folded = screen.getByText('3/4').parentElement
    expect(folded?.className).toContain('hidden')
    expect(folded.className).toContain('sm:inline-flex')
  })
})

// ---------------------------------------------------------------------------
// Erow — card mode folds actions/meta into the wrapped card's foot props
// ---------------------------------------------------------------------------

type StubCardProps = {
  footActions?: React.ReactNode
  footMeta?: Array<{ label: string; value: React.ReactNode }>
}

// biome-ignore lint/style/useComponentExportOnlyModules: test-local stub component; Fast Refresh does not apply to test files
function StubCard({ footActions, footMeta }: StubCardProps) {
  return (
    <div>
      <span>Card body</span>
      {footMeta?.map((m) => (
        <span key={m.label}>
          {m.label}: {m.value}
        </span>
      ))}
      {footActions}
    </div>
  )
}

describe('Erow — mode card (shipped default)', () => {
  test('injects footActions and footMeta into the wrapped card', () => {
    render(
      <Ecflow>
        <Erow
          actions={<button type="button">Spend AP</button>}
          footMeta={[{ label: 'AP Cost', value: 1 }]}
        >
          <StubCard />
        </Erow>
      </Ecflow>
    )
    expect(screen.getByRole('button', { name: 'Spend AP' })).toBeTruthy()
    expect(screen.getByText('AP Cost: 1')).toBeTruthy()
  })

  test('Ecflow caps the entity-card grid at 2 columns on desktop, 1 on mobile', () => {
    // Redesign rule: max 2 columns for any entity-card grid.
    const { container } = render(
      <Ecflow>
        <Erow>
          <StubCard />
        </Erow>
      </Ecflow>
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
  })
})

describe('Erow — mode rail', () => {
  test('renders the side callout with meta and actions beside the card', () => {
    render(
      <Erow
        mode="rail"
        actions={<button type="button">Repair</button>}
        footMeta={[{ label: 'Slots', value: 2 }]}
      >
        <StubCard />
      </Erow>
    )
    expect(screen.getByText('Card body')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Repair' })).toBeTruthy()
    expect(screen.getByText('Slots')).toBeTruthy()
  })
})
