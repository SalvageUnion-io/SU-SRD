/**
 * Unit tests for the shared EntitySearcher.
 *
 * Focus: the legibility contract that motivated the component — equipped items
 * are unmistakable (rail + Equipped tag), the Status facet splits equipped vs.
 * available, the budget track renders honestly, and toggle/count emit the
 * caller's identity. Then the rail's own contract: it is a named region that
 * never sits over the results — a collapsed disclosure band on a narrow screen,
 * an always-open column on a wide one, a one-line bar in single mode — and a
 * Remove hands focus on instead of dropping it. Renders against real
 * SalvageUnionReference data (the searcher reads the ORM directly).
 *
 * happy-dom's viewport is 1024px wide, below the rail's 80rem breakpoint, so
 * every test renders the NARROW rail unless it widens the window itself.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'

type Equip = { id: string; name: string; techLevel: number | 'B' | 'N' }

function allEquipment(): Equip[] {
  return SalvageUnionReference.Equipment.all()
}

function nth(list: Equip[], i: number): Equip {
  const item = list[i]
  if (!item) throw new Error(`No equipment at index ${i} in reference data`)
  return item
}

/** Three equipment items with distinct names, so their Remove buttons differ. */
function threeEquipment(): [Equip, Equip, Equip] {
  const byName = new Map(allEquipment().map((e) => [e.name, e]))
  const [a, b, c] = [...byName.values()]
  if (!a || !b || !c) throw new Error('Need three distinctly-named equipment items')
  return [a, b, c]
}

/** The caller owns `selected` (ADR-010) — a stateful harness, like a sheet. */
function ControlledEquipment({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <EntitySearcher
      schema="equipment"
      selected={selected}
      onToggle={(ref) =>
        setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref]))
      }
      idOf={(i) => i.id}
      chosenLabel="Equipped"
    />
  )
}

function rail(name: RegExp | string = /equipped/i): HTMLElement {
  return screen.getByRole('region', { name })
}

/** Open the narrow band's disclosure and return it. */
function expand(region: HTMLElement): HTMLElement {
  const toggle = within(region).getByRole('button', { expanded: false })
  fireEvent.click(toggle)
  return toggle
}

type HappyWindow = { happyDOM: { setViewport: (size: { width: number; height: number }) => void } }

/** Inside `act()`: a resize fires matchMedia `change`, and the searcher — still
 * mounted when an `afterEach` runs — re-renders through `useWideRail`. */
function setViewport(width: number, height: number) {
  act(() => {
    ;(window as unknown as HappyWindow).happyDOM.setViewport({ width, height })
  })
}

describe('EntitySearcher — equipment (toggle mode)', () => {
  it('renders a Tech level and a Show facet', () => {
    render(
      <EntitySearcher schema="equipment" selected={[]} onToggle={() => {}} idOf={(i) => i.id} />
    )
    expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /filter by show/i })).toBeTruthy()
  })

  it('lists an equipped item in the rail with an Equipped tag', () => {
    const eq = nth(allEquipment(), 0)
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        chosenLabel="Equipped"
      />
    )
    const entry = screen.getByTestId('rail-entry')
    expect(within(entry).getByText(eq.name)).toBeTruthy()
    expect(screen.getByText(/Equipped ✓/)).toBeTruthy()
  })

  it('clicking an unselected card toggles with idOf(item)', () => {
    const eq = nth(allEquipment(), 0)
    const toggled: string[] = []
    render(
      <EntitySearcher
        schema="equipment"
        selected={[]}
        onToggle={(ref) => toggled.push(ref)}
        idOf={(i) => i.id}
      />
    )
    const toggleBtn = screen.getAllByRole('button', { name: eq.name })[0]
    if (!toggleBtn) throw new Error('no toggle button rendered')
    fireEvent.click(toggleBtn)
    expect(toggled).toEqual([eq.id])
  })

  it('removing from the rail emits the matched stored ref', () => {
    const eq = nth(allEquipment(), 0)
    const toggled: string[] = []
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={(ref) => toggled.push(ref)}
        idOf={(i) => i.id}
      />
    )
    const region = rail(/selected/i)
    expand(region)
    fireEvent.click(within(region).getByRole('button', { name: `Remove ${eq.name}` }))
    expect(toggled).toEqual([eq.id])
  })

  it('the Status facet filters to selected-only', () => {
    const a = nth(allEquipment(), 0)
    const b = nth(allEquipment(), 1)
    render(
      <EntitySearcher schema="equipment" selected={[a.id]} onToggle={() => {}} idOf={(i) => i.id} />
    )
    expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /selected only/i }))
    expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
    if (b.id !== a.id) {
      expect(screen.queryByRole('button', { name: b.name })).toBeNull()
    }
  })

  it('renders a soft budget track when budget is provided', () => {
    render(
      <EntitySearcher
        schema="equipment"
        selected={[]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        budget={{ label: 'Inventory slots', used: 2, max: 5 }}
      />
    )
    expand(rail(/selected/i))
    expect(screen.getByText('2 / 5')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
  })
})

describe('EntitySearcher — systems (count mode)', () => {
  it('shows an Add affordance and emits idOf on add', () => {
    const sys = SalvageUnionReference.Systems.all()
    const first = sys[0]
    if (!first) throw new Error('No systems in reference data')
    const added: string[] = []
    render(
      <EntitySearcher
        schema="systems"
        mode="count"
        selected={[]}
        onAdd={(ref) => added.push(ref)}
        idOf={(i) => i.name}
        chosenLabel="Installed"
      />
    )
    const addBtn = screen.getAllByRole('button', {
      name: new RegExp(`Add ${first.name}`, 'i'),
    })[0]
    if (!addBtn) throw new Error('no Add button rendered')
    fireEvent.click(addBtn)
    expect(added).toEqual([first.name])
  })

  it('names each duplicate copy’s Remove, and removes that copy by index', () => {
    const first = SalvageUnionReference.Systems.all()[0]
    if (!first) throw new Error('No systems in reference data')
    const removed: number[] = []
    render(
      <EntitySearcher
        schema="systems"
        mode="count"
        selected={[first.name, first.name]}
        onRemove={(index) => removed.push(index)}
        chosenLabel="Installed"
      />
    )
    const region = rail(/installed/i)
    expand(region)
    expect(
      within(region).getByRole('button', { name: `Remove ${first.name}, copy 1 of 2` })
    ).toBeTruthy()
    fireEvent.click(
      within(region).getByRole('button', { name: `Remove ${first.name}, copy 2 of 2` })
    )
    expect(removed).toEqual([1])
  })
})

describe('EntitySearcher — the rail on a narrow screen', () => {
  it('is a named region ABOVE the pool, in DOM (and so focus) order', () => {
    const eq = nth(allEquipment(), 0)
    render(<ControlledEquipment initial={[eq.id]} />)
    const summary = screen.getByText(/showing \d+ of \d+/i)
    expect(rail().compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('starts collapsed: count and budget at a glance, the entries folded away', () => {
    const eq = nth(allEquipment(), 0)
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        chosenLabel="Equipped"
        budget={{ label: 'Inventory slots', used: 2, max: 5 }}
      />
    )
    const region = rail()
    const toggle = within(region).getByRole('button', { expanded: false })
    expect(toggle.textContent).toContain('1')
    const list = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(list?.hidden).toBe(true)
    expect(within(region).getByText('2/5')).toBeTruthy()
    expect(within(region).queryByRole('button', { name: /^Remove/ })).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(list?.hidden).toBe(false)
    expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
    // Expanded, the one-line readout gives way to the full pip track.
    expect(within(region).getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
    expect(within(region).queryByText('2/5')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(list?.hidden).toBe(true)
  })

  it('hands focus to the entry now in the removed one’s place, then to the toggle', () => {
    const [a, b, c] = threeEquipment()
    render(<ControlledEquipment initial={[a.id, b.id, c.id]} />)
    const region = rail()
    const toggle = expand(region)
    const removeButton = (eq: Equip) =>
      within(region).getByRole('button', { name: `Remove ${eq.name}` })

    // A middle entry → the one that slid up into its place.
    fireEvent.click(removeButton(b))
    expect(document.activeElement).toBe(removeButton(c))
    // The last entry → the one before it.
    fireEvent.click(removeButton(c))
    expect(document.activeElement).toBe(removeButton(a))
    // The only entry → the rail's own heading control, never <body>.
    fireEvent.click(removeButton(a))
    expect(document.activeElement).toBe(toggle)
    expect(within(region).getByText('Nothing equipped yet.')).toBeTruthy()
  })

  it('announces the count politely, and only once it changes', () => {
    const eq = nth(allEquipment(), 0)
    render(<ControlledEquipment initial={[]} />)
    const status = within(rail()).getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')

    const card = screen.getAllByRole('button', { name: eq.name })[0]
    if (!card) throw new Error('no pool card rendered')
    fireEvent.click(card)
    expect(status.textContent).toBe('1 equipped')
  })
})

describe('EntitySearcher — a phone (390×844)', () => {
  const initial = { width: window.innerWidth, height: window.innerHeight }
  // The viewport is process-global (happy-dom's window), so put it back.
  beforeEach(() => setViewport(390, 844))
  afterEach(() => setViewport(initial.width, initial.height))

  it('keeps the header short: search in reach, the facet rows folded behind Filters', () => {
    render(<ControlledEquipment initial={[]} />)
    expect(screen.getByLabelText('Search')).toBeTruthy()
    const filters = screen.getByRole('button', { name: /^filters/i })
    expect(filters.getAttribute('aria-expanded')).toBe('false')
    const panel = document.getElementById(filters.getAttribute('aria-controls') ?? '')
    expect(panel?.hidden).toBe(true)
    expect(screen.queryByRole('group', { name: /filter by tech level/i })).toBeNull()

    fireEvent.click(filters)
    expect(filters.getAttribute('aria-expanded')).toBe('true')
    expect(panel?.hidden).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /equipped only/i }))
    // Folded again, the toggle still says a filter is applied.
    fireEvent.click(filters)
    expect(screen.getByRole('button', { name: 'Filters 1 active' })).toBeTruthy()
  })

  it('lets the body shrink and scroll under a viewport-capped frame', () => {
    // The phone bug: the header filled the screen and the bare popup's
    // `overflow: hidden` left the results and the selection unreachable. The
    // fix is a chain — frame capped, body allowed to shrink, `.su-searcher` the
    // scroll container that fills it — and this pins the two links the
    // component owns (the stylesheet supplies the third).
    render(<ControlledEquipment initial={[]} />)
    const scroller = document.querySelector<HTMLElement>('.su-searcher')
    const body = scroller?.parentElement
    expect(body?.style.minHeight).toMatch(/^0(px)?$/)
    expect(rail().parentElement).toBe(scroller ?? null)
  })
})

describe('EntitySearcher — a tablet (1024×768)', () => {
  it('opens Filters by default: there is room for the facet rows', () => {
    render(<ControlledEquipment initial={[]} />)
    expect(screen.getByRole('button', { name: /^filters/i }).getAttribute('aria-expanded')).toBe(
      'true'
    )
    expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
  })
})

describe('EntitySearcher — the rail on a wide screen', () => {
  const initial = { width: window.innerWidth, height: window.innerHeight }
  // The viewport is process-global (happy-dom's window), so put it back.
  beforeEach(() => setViewport(1440, 900))
  afterEach(() => setViewport(initial.width, initial.height))

  it('is an always-open column with a plain heading, AFTER the pool', () => {
    const eq = nth(allEquipment(), 0)
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        chosenLabel="Equipped"
        budget={{ label: 'Inventory slots', used: 2, max: 5 }}
      />
    )
    // The facet rows sit inline in the sub-header — no Filters disclosure.
    expect(screen.queryByRole('button', { name: /^filters/i })).toBeNull()
    expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
    const region = rail()
    expect(region.querySelector('[aria-expanded]')).toBeNull()
    expect(within(region).getByRole('heading', { name: /equipped/i })).toBeTruthy()
    expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
    expect(within(region).getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
    const summary = screen.getByText(/showing \d+ of \d+/i)
    expect(region.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('becomes the column when the viewport widens past the breakpoint', () => {
    // Mounted narrow, then widened. (Only this direction is testable: happy-dom's
    // MediaQueryList seeds its last-seen state as `false`, not the real one, so
    // it never reports a query that STARTS true going false.)
    setViewport(1024, 900)
    const eq = nth(allEquipment(), 0)
    render(<ControlledEquipment initial={[eq.id]} />)
    expect(within(rail()).getByRole('button', { expanded: false })).toBeTruthy()
    setViewport(1440, 900)
    expect(rail().querySelector('[aria-expanded]')).toBeNull()
    expect(within(rail()).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
  })

  it('focuses the heading once the last entry is removed', () => {
    const eq = nth(allEquipment(), 0)
    render(<ControlledEquipment initial={[eq.id]} />)
    const region = rail()
    fireEvent.click(within(region).getByRole('button', { name: `Remove ${eq.name}` }))
    expect(document.activeElement).toBe(within(region).getByRole('heading', { name: /equipped/i }))
  })
})

describe('EntitySearcher — single mode', () => {
  it('is a one-line bar: the chosen name and the confirm actions, nothing to fold', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]
    if (!chassis) throw new Error('No chassis in reference data')
    render(
      <EntitySearcher
        schema="chassis"
        mode="single"
        selected={[chassis.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        chosenLabel="Chosen"
        railActions={<button type="button">Apply chassis</button>}
      />
    )
    const bar = rail('Chosen')
    expect(within(bar).getByTestId('rail-entry').textContent).toBe(chassis.name)
    expect(bar.querySelector('[aria-expanded]')).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Apply chassis' })).toBeTruthy()
  })
})
