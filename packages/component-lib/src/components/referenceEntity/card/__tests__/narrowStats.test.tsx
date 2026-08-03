/**
 * The header's NARROW fallback — what a full card's stat cluster does when the
 * band is too small to seat its vertical value boxes.
 *
 * The bug: the cluster was `shrink-0`, so the `flex-wrap` beside it could never
 * engage (a flex item that cannot shrink never reaches a width its children
 * must wrap at). A chassis' eight stats therefore ran a ~420px line straight
 * off the side of a phone-width card, over the breadcrumb and out of the
 * viewport. The fix has two layers, and both are pinned here:
 *
 *   1. the cluster SHRINKS (so the boxes wrap onto a second row) — the floor
 *      for every case the measurement below declines to judge (an unmeasurable
 *      band, no `ResizeObserver`). It is not what a crawler sees: srd gates the
 *      card behind `GameDataGate` and serves `StaticEntityContent` to no-JS
 *      readers, and ITUN is client-only, so the card is never server-rendered;
 *   2. once mounted the header MEASURES itself and, when the boxes don't fit,
 *      swaps to the compact `[label | value]` cells with their short-form
 *      labels (SV / SYS / MODS) — the same badge anatomy a listing card uses.
 *
 * happy-dom performs no layout, so the measurement is driven here by stubbing
 * `clientWidth` + `ResizeObserver`. That stubbing is also why the production
 * code treats a width of 0 as "no verdict": without that guard every card in
 * every other test would measure as cramped and silently render the wrong
 * anatomy.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { EntityCardHeader } from '../EntityCardHeader'
import type { StatItem } from '../../../shared/statsBarTypes'

// The Mule's header cluster, in both label forms — the card builds these two
// lists off one entity and hands the header both.
const FULL_STATS: StatItem[] = [
  { key: 'tech-level', label: 'Tech', bottomLabel: 'Level', value: '1' },
  { key: 'structurePoints', label: 'Structure', bottomLabel: 'Points', value: 12 },
  { key: 'energyPoints', label: 'Energy', bottomLabel: 'Points', value: 4 },
  { key: 'salvageValue', label: 'Salvage', bottomLabel: 'Value', value: 7 },
  { key: 'systemSlots', label: 'System', bottomLabel: 'Slots', value: 16 },
  { key: 'moduleSlots', label: 'Module', bottomLabel: 'Slots', value: 2 },
  { key: 'cargoCapacity', label: 'Cargo', bottomLabel: 'Capacity', value: 16 },
  { key: 'heatCapacity', label: 'Heat', bottomLabel: 'Capacity', value: 6 },
]
const NARROW_STATS: StatItem[] = [
  { key: 'tech-level', label: 'TL', value: '1' },
  { key: 'structurePoints', label: 'SP', value: 12 },
  { key: 'energyPoints', label: 'EP', value: 4 },
  { key: 'salvageValue', label: 'SV', value: 7 },
  { key: 'systemSlots', label: 'SYS', value: 16 },
  { key: 'moduleSlots', label: 'MODS', value: 2 },
  { key: 'cargoCapacity', label: 'Cargo', value: 16 },
  { key: 'heatCapacity', label: 'Heat', value: 6 },
]

/**
 * Render the header inside a band that measures `width`.
 *
 * `clientWidth` is stubbed on `HTMLElement.prototype` — that is where happy-dom
 * defines it, and a getter installed on `Element.prototype` is shadowed by it
 * and silently does nothing. The `ResizeObserver` stub keeps happy-dom's real
 * one from firing a second, unwrapped measurement after the assertions.
 */
function renderAtWidth(width: number, count = FULL_STATS.length) {
  const realObserver = globalThis.ResizeObserver
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  try {
    return render(
      <EntityCardHeader
        title="Mule"
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-5xl"
        stats={FULL_STATS.slice(0, count)}
        narrowStats={NARROW_STATS.slice(0, count)}
      />
    )
  } finally {
    globalThis.ResizeObserver = realObserver
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
  }
}

afterEach(cleanup)

describe('header stats under width pressure', () => {
  test('a phone-width band renders the SHORT-form badge cells', () => {
    // 8 stats want 8×52px of boxes plus room for the name — far past 320.
    const { container } = renderAtWidth(320)

    expect(screen.getByText('SV')).toBeTruthy()
    // The two-line long form belongs to the value box, which is not what this
    // width renders.
    expect(container.textContent).not.toContain('Salvage')
  })

  test('a desktop-width band keeps the vertical value boxes', () => {
    const { container } = renderAtWidth(1114)

    expect(screen.getByText('Salvage')).toBeTruthy()
    expect(screen.getByText('Value')).toBeTruthy()
    expect(container.textContent).not.toContain('SV')
  })

  test('a small cluster keeps its boxes even on a phone', () => {
    // The verdict is a function of the CARD's width AND its stat COUNT, not of
    // a viewport breakpoint: one Tech Level box fits a 320px band comfortably.
    renderAtWidth(320, 1)

    expect(screen.getByText('Level')).toBeTruthy()
  })

  test('an unmeasurable band is not a verdict — the boxes stay', () => {
    // Width 0 is what a display:none ancestor (and every other happy-dom test)
    // reports. Treating it as "cramped" would flip every card to the cells.
    const { container } = renderAtWidth(0)

    expect(container.textContent).toContain('Salvage')
  })
})

describe('a listing card renders the cells too', () => {
  test('and takes the short-form labels with them', () => {
    // `listing` puts the stats on the compact cells without being `compact`, so
    // a `size="large" extent="head"` card's `stats` still carry the two-line
    // long form. Reading them from `stats` would seat "Structure / Points"
    // inside a shortform cell — the labels and the anatomy must move together.
    const { container } = render(
      <EntityCardHeader
        title="Mule"
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-5xl"
        stats={FULL_STATS}
        narrowStats={NARROW_STATS}
        listing
      />
    )

    expect(screen.getByText('SYS')).toBeTruthy()
    expect(container.textContent).not.toContain('Structure')
  })
})

describe('the unmeasured floor', () => {
  test('the value-box cluster can shrink, so it wraps instead of overflowing', () => {
    // `shrink-0` here is the original bug: it pinned the cluster at max-content,
    // so the wrap never engaged and the row ran off the card.
    const { container } = render(
      <EntityCardHeader
        title="Mule"
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-5xl"
        stats={FULL_STATS}
        narrowStats={NARROW_STATS}
      />
    )
    const cluster = screen.getByText('Salvage').closest('div.flex-wrap')
    expect(cluster).toBeTruthy()
    expect(cluster?.className).not.toContain('shrink-0')
    expect(container.querySelector('.flex-wrap')).toBeTruthy()
  })
})
