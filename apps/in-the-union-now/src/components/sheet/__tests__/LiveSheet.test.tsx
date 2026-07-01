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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).IntersectionObserver = MockIntersectionObserver
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
      back={{ href: '/', label: 'Dashboard' }}
      pill={{ label: 'Pilot', tone: 'pilot' }}
      wired={false}
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
  // The condensed block wraps the sheet name shown in the strip.
  const name = screen.getByText('Mara Vex')
  return name.parentElement as HTMLElement
}

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
      observerCallbacks[0]!([{ isIntersecting: false }])
    })

    const wrapper = stripWrapper()
    expect(wrapper.getAttribute('aria-hidden')).toBe('false')
    expect(wrapper.className).not.toContain('pointer-events-none')
    expect(wrapper.className).toContain('opacity-100')
    // Live MiniStat readout present in the condensed bar
    expect(screen.getByLabelText('HP 7 of 10')).toBeTruthy()
    expect(screen.getByText('Pilot')).toBeTruthy()
  })

  test('hero back in view: strip hides again', () => {
    renderShell()
    act(() => {
      observerCallbacks[0]!([{ isIntersecting: false }])
    })
    act(() => {
      observerCallbacks[0]!([{ isIntersecting: true }])
    })
    expect(stripWrapper().getAttribute('aria-hidden')).toBe('true')
  })

  test('condense=false renders no strip and observes nothing', () => {
    renderShell({ condense: false })
    expect(screen.queryByText('Mara Vex')).toBeNull()
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
      observerCallbacks[0]!([{ isIntersecting: false }])
    })
    expect(screen.getByLabelText('Hold 4 of 6')).toBeTruthy()
    // Non-overlaid keys keep their own value
    expect(screen.getByLabelText('HP 7 of 10')).toBeTruthy()
  })

  test('wired toggle reflects the wired prop', () => {
    renderShell({ wired: true })
    expect(screen.getByRole('switch', { name: /wired/i })).toBeTruthy()
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
      observerCallbacks[0]!([{ isIntersecting: false }])
    })
    // Priority readout always visible; non-priority carries the fold classes.
    expect(screen.getByLabelText('SP 5 of 8').className).not.toContain('hidden')
    const folded = screen.getByLabelText('EP 3 of 4')
    expect(folded.className).toContain('hidden')
    expect(folded.className).toContain('sm:inline-flex')
  })

  test('fab slot renders the floating node', () => {
    renderShell({ fab: <button type="button">Roll d20</button> })
    expect(screen.getByRole('button', { name: 'Roll d20' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Erow — card mode folds actions/meta into the wrapped card's foot props
// ---------------------------------------------------------------------------

type StubCardProps = {
  footActions?: React.ReactNode
  footMeta?: Array<{ label: string; value: React.ReactNode }>
}

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

  test('grow weights the flex basis', () => {
    const { container } = render(
      <Erow grow={1.35}>
        <StubCard />
      </Erow>
    )
    const item = container.firstElementChild as HTMLElement
    expect(item.style.flex).toContain('1.35')
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
