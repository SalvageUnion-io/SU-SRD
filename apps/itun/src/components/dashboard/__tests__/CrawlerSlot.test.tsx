/**
 * The Crawler Major's Downtime verbs, as the Mediator runs them (ADR-038 §3):
 * Area Salvage rolls and deposits Scrap; Craft lists what the Tech Level allows
 * and teaches the shortfall instead of hiding an item; Upkeep that the pool
 * cannot cover is blocked by the rule; Break down commits the mech and the
 * crawler as one transfer. An unreadable Tech Level blocks Salvage with its
 * rule. `SlotRow.test.tsx` covers the bays a player sees and Upkeep's claim.
 *
 * The d20 comes from Randsum, which draws on `Math.random`; pinning it makes
 * the Area Salvage roll a known row (0.5 → 11, "Winning"; 0 → 1, "Nothing").
 */

import { afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { dieForTable } from 'component-lib'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { Mech } from 'itun-domain/schemas/mech'
import { crawlerFixture, mechFixture } from '../../__tests__/fixtures'
import type { CrawlerUpkeep } from '../CrawlerSlot'
import { CrawlerMajor } from '../CrawlerSlot'
import type { PlayStore } from '../SlotRow'

type Update = { type: string; id: string; patch: Record<string, unknown> }
type Transfer = { updates: Update[] }

/** A store that hands back the given rows and records every write. */
function recording(crawler: Crawler, mech: Mech | null = null) {
  const updates: Update[] = []
  const transfers: Transfer[] = []
  const store = {
    get: (type: string, id: string) =>
      type === 'crawler' && id === crawler.id
        ? crawler
        : type === 'mech' && mech !== null && id === mech.id
          ? mech
          : null,
    update: async (type: string, id: string, patch: Record<string, unknown>) => {
      updates.push({ type, id, patch })
      return crawler
    },
    transfer: async (plan: Transfer) => {
      transfers.push(plan)
    },
  } as unknown as PlayStore
  return { store, updates, transfers }
}

const hen = crawlerFixture({
  id: 'c1',
  name: 'Mother Hen',
  techLevel: 'tech-2',
  scrapPool: { tl2: 3 },
  upgradePool: 4,
})

async function renderMajor({
  crawler = hen,
  mech = null,
  mediator = true,
  upkeep = null,
  store = recording(crawler, mech).store,
}: {
  crawler?: Crawler
  mech?: Mech | null
  mediator?: boolean
  upkeep?: CrawlerUpkeep | null
  store?: PlayStore
} = {}) {
  await act(async () => {
    render(
      <CrawlerMajor
        crawler={crawler}
        mech={mech}
        store={store}
        mediator={mediator}
        upkeep={upkeep}
        stampLabel="Downtime"
      />
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

/** The Hull bay's chips, label then value. */
function hullCells(): string[] {
  const hull = screen.getByText('Hull').parentElement
  if (!hull) throw new Error('no Hull bay')
  return [...hull.querySelectorAll('.su-stat-cell')].map((c) => c.textContent ?? '')
}

function overlay(title: string) {
  return within(screen.getByRole('dialog', { name: title }))
}

/** Every label-first chip on the slot, as `LABEL value` strings. */
function statChips(): string[] {
  return [...document.querySelectorAll('.su-stat-cell')].map((cell) =>
    [...cell.children].map((part) => part.textContent).join(' ')
  )
}

let random: ReturnType<typeof spyOn> | null = null

// The table dice load on first use (a dynamic import); loaded here, a roll is
// microtasks only and settles inside the click's act().
beforeAll(async () => {
  await dieForTable('Area Salvage')
})

afterEach(() => {
  random?.mockRestore()
  random = null
})

describe('the bays', () => {
  test('Hull reads the Tech Level as a chip; Upgrade reads the pool against the next one', async () => {
    await renderMajor()
    expect(hullCells()).toContain('TL2')
    // Counts are label-first chips: `POOL | 4/n`, `NEXT TECH | 3`, `SCRAP | 5`, `TL | 2`.
    const chips = statChips()
    expect(chips.find((c) => c.startsWith('Pool'))).toMatch(/^Pool 4\/\d+$/)
    expect(chips).toContain('Next Tech 3')
    expect(chips).toContain('Scrap 5')
    expect(chips).toContain('TL 2')
    expect(screen.getByText('No bays installed.')).toBeTruthy()
  })

  test('an unreadable Tech Level is said as unknown, and the Upkeep line drops it', async () => {
    await renderMajor({ crawler: { ...hen, techLevel: 'not-a-level' } })
    expect(hullCells()).toContain('TL?')
    const chips = statChips()
    expect(chips).toContain('Scrap 5')
    // Only the hull's own `TL | ?` remains: Upkeep drops its TL, Upgrade its pool.
    expect(chips.filter((c) => c.startsWith('TL'))).toEqual(['TL ?'])
    expect(chips.some((c) => c.startsWith('Pool'))).toBe(false)
    expect(screen.getByText('No further Tech Level')).toBeTruthy()
  })

  test('each bay is its Token; a damaged one greys and says DAMAGED, and a bay that does not resolve says so', async () => {
    await renderMajor({
      crawler: {
        ...hen,
        crawlerBays: [
          { bayRef: 'mech-bay', condition: 'damaged' },
          { bayRef: 'not-a-bay', condition: 'damaged' },
        ],
      },
    })
    const bays = screen.getByText('Bays').parentElement
    if (!bays) throw new Error('no Bays bay')
    const token = bays.querySelector('.su-entity-token__pill')
    expect(token?.textContent).toContain('Mech Bay')
    // The grey is joined by the condition chip an item line shows, last in the pill's chips.
    const chips = token?.querySelector('.su-entity-token__chips')
    expect(chips?.lastElementChild?.textContent).toBe('Damaged')
    expect(within(bays).queryByText('Mech Bay damaged')).toBeNull()
    expect(within(bays).getByText('not-a-bay damaged')).toBeTruthy()
  })

  test('with no mech to break down, there is no Break down', async () => {
    await renderMajor({ mech: null })
    expect(screen.queryByRole('button', { name: /Break down/ })).toBeNull()
  })
})

describe('Area Salvage', () => {
  test('a high roll deposits Scrap of the Tech Level into the pool and says how much', async () => {
    random = spyOn(Math, 'random').mockReturnValue(0.5)
    const { store, updates } = recording(hen)
    await renderMajor({ store })
    await click(screen.getByRole('button', { name: 'Salvage' }))
    expect(updates).toHaveLength(1)
    const pool = updates[0]?.patch.scrapPool as Record<string, number>
    const found = (pool.tl2 ?? 0) - 3
    expect(found).toBeGreaterThan(0)
    expect(
      overlay('Area Salvage').getByText(
        new RegExp(`^\\d+: .+ — ${found} Tech 2 Scrap into the pool\\.$`)
      )
    ).toBeTruthy()
  })

  test('a roll that finds nothing writes nothing', async () => {
    random = spyOn(Math, 'random').mockReturnValue(0)
    const { store, updates } = recording(hen)
    await renderMajor({ store })
    await click(screen.getByRole('button', { name: 'Salvage' }))
    expect(updates).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('with no readable Tech Level, Salvage is blocked by the rule', async () => {
    const odd = { ...hen, techLevel: 'not-a-level' }
    const { store, updates } = recording(odd)
    await renderMajor({ crawler: odd, store })
    await click(screen.getByRole('button', { name: 'Salvage' }))
    const blocked = overlay('Blocked by a rule')
    expect(blocked.getByText(/Tech Level cannot be read/)).toBeTruthy()
    await click(blocked.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updates).toEqual([])
  })
})

describe('Craft', () => {
  test('lists what the Tech Level allows, crafts what the pool covers, and says where it went', async () => {
    const rich = { ...hen, scrapPool: { tl1: 40, tl2: 40 } }
    const { store, updates } = recording(rich)
    await renderMajor({ crawler: rich, store })
    await click(screen.getByRole('button', { name: 'Craft' }))
    const craft = overlay('Craft')
    const rows = craft.getAllByRole('button').filter((b) => /Scrap$/.test(b.textContent ?? ''))
    expect(rows.length).toBeGreaterThan(0)
    // Nothing above the crawler's Tech 2.
    for (const row of rows) expect(row.textContent).toMatch(/T[12] · \d+ Scrap$/)

    const first = rows[0] as HTMLElement
    const name = first.querySelector('span')?.textContent ?? ''
    await click(first)
    expect(updates).toHaveLength(1)
    expect(updates[0]?.type).toBe('crawler')
    expect(
      craft.getByText(new RegExp(`^Crafted ${name} for \\d+ Scrap — it is in the Hold\\.$`))
    ).toBeTruthy()
  })

  test('an item the pool cannot cover is listed, and Craft names the shortfall', async () => {
    const poor = { ...hen, scrapPool: {} }
    const { store, updates } = recording(poor)
    await renderMajor({ crawler: poor, store })
    await click(screen.getByRole('button', { name: 'Craft' }))
    const craft = overlay('Craft')
    const first = craft.getAllByRole('button').find((b) => /Scrap$/.test(b.textContent ?? ''))
    if (!first) throw new Error('no craftable item')
    await click(first)
    expect(updates).toEqual([])
    expect(craft.getByText(/costs \d+ Scrap at Tech \d\+; the pool is \d+ short\./)).toBeTruthy()
  })
})

describe('Upkeep the pool cannot cover', () => {
  test('is blocked by the rule, and nothing is claimed or drawn', async () => {
    const claims: boolean[] = []
    const upkeep: CrawlerUpkeep = {
      spent: false,
      payable: true,
      spend: async () => {
        claims.push(true)
        return true
      },
    }
    const { store, updates } = recording(hen)
    await renderMajor({ store, upkeep })
    expect(screen.getByText('Outstanding')).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Pay Upkeep' }))
    expect(
      overlay('Blocked by a rule').getByText(
        /Upkeep is 5 Scrap of Tech 2 or higher, and the pool is 2 short\./
      )
    ).toBeTruthy()
    expect(claims).toEqual([])
    expect(updates).toEqual([])
  })
})

describe('Break down a Mech', () => {
  test('commits the crawler and the mech as one transfer, and says what it yielded', async () => {
    const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'mule' })
    const { store, transfers, updates } = recording(hen, mech)
    await renderMajor({ mech, store })
    const button = screen.getByRole('button', { name: 'Break down' })
    expect(button.getAttribute('title')).toBe('Break Iron Mongrel down into Scrap — destructive')
    await click(button)
    expect(updates).toEqual([])
    expect(transfers).toHaveLength(1)
    const [crawlerHalf, mechHalf] = transfers[0]?.updates ?? []
    expect(crawlerHalf?.type).toBe('crawler')
    expect(crawlerHalf?.id).toBe('c1')
    expect(mechHalf).toEqual({ type: 'mech', id: 'm1', patch: { destroyed: true, cargoLots: [] } })
    expect(overlay('Mech broken down').getByText(/^\d+ Scrap into the pool/)).toBeTruthy()
  })
})
