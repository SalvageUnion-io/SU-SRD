/**
 * SalvageControl — Area + Mech Salvage roller tests (design-review R-3).
 *
 * ADR-007 coverage:
 *   1. Area Salvage scrap bands auto-deposit into the crawler's TL pool
 *      bucket and burn 1 Supply per roll (p.245).
 *   2. An Area Salvage 20 opens a TL-restricted claim; the player's pick
 *      lands in the hold as a Damaged lot (never auto-picked).
 *   3. Supply exhaustion disables the roll (hand-editable, honor system).
 *   4. Mech Salvage 2-5 auto-deposits half the chassis SV in scrap.
 *   5. Mech Salvage 20 auto-deposits the wreck chassis, then walks the
 *      player through one System AND one Module claim.
 *
 * Uses the store-injection seam + patched reference model `.all`s and an
 * injectable d20 (same pattern as CrawlerSheet-editable). NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SalvageControl } from '../SalvageControl'
import type { Roll } from '../../../lib/rules/heatCheck'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Reference model patches (chassis/systems/modules resolve in the pickers)
// ---------------------------------------------------------------------------

const MOCK_CHASSIS = [
  { id: 'mule', name: 'Mule', techLevel: 1, salvageValue: 7 },
  { id: 'sledge', name: 'Sledge', techLevel: 2, salvageValue: 10 },
]
const MOCK_SYSTEMS = [
  { id: 'red-laser', name: 'Red Laser', techLevel: 1, salvageValue: 3 },
  { id: 'heavy-laser', name: 'Heavy Laser', techLevel: 2, salvageValue: 4 },
]
const MOCK_MODULES = [{ id: 'overdrive', name: 'Overdrive', techLevel: 1, salvageValue: 2 }]

async function patchReference(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  const originals = [
    SalvageUnionReference.Chassis.all.bind(SalvageUnionReference.Chassis),
    SalvageUnionReference.Systems.all.bind(SalvageUnionReference.Systems),
    SalvageUnionReference.Modules.all.bind(SalvageUnionReference.Modules),
  ] as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Chassis.all = mock(() => MOCK_CHASSIS as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Systems.all = mock(() => MOCK_SYSTEMS as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Modules.all = mock(() => MOCK_MODULES as any)
  return () => {
    SalvageUnionReference.Chassis.all = originals[0]
    SalvageUnionReference.Systems.all = originals[1]
    SalvageUnionReference.Modules.all = originals[2]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeCrawler: Crawler = {
  id: 'crawler-salvage-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  scrapPool: { tl2: 1 },
  cargoLots: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStubStore(
  crawler: Crawler,
  update = mock(async () => crawler)
): { store: typeof useEntityStore; update: ReturnType<typeof mock> } {
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay: mock(async () => crawler),
    delete: mock(async () => {}),
  }
  return { store: (() => storeState) as unknown as typeof useEntityStore, update }
}

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

// ---------------------------------------------------------------------------
// Area Salvage
// ---------------------------------------------------------------------------

describe('SalvageControl — Area Salvage (pp.245/248)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('a scrap band auto-deposits into the area-TL pool bucket and burns Supply', async () => {
    restore = await patchReference()
    const { store, update } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(15)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Area Salvage' }))
    })

    // Area TL defaults to the crawler's TL (2): 11-19 → 3 Scrap into tl2 (1+3).
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      scrapPool: { tl2: 4 },
    })
    expect(screen.getByRole('status').textContent).toContain('rolled 15 — Winning')
    expect(screen.getByText('1 attempt used')).toBeTruthy()
    expect(screen.getByLabelText('Supply remaining: 4')).toBeTruthy()
  })

  test('a 20 opens a TL-restricted claim; the pick lands in the hold Damaged', async () => {
    restore = await patchReference()
    const { store, update } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(20)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Area Salvage' }))
    })

    // No scrap deposit on a jackpot.
    expect(update).not.toHaveBeenCalled()

    // The claim picker only offers TL-2 entities (Sledge chassis, Heavy Laser).
    const select = screen.getByLabelText('Salvaged item') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels.join(' ')).toContain('Sledge')
    expect(optionLabels.join(' ')).toContain('Heavy Laser')
    expect(optionLabels.join(' ')).not.toContain('Mule')

    await act(async () => {
      fireEvent.change(select, { target: { value: 'chassis:sledge' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add to hold' }))
    })

    expect(update).toHaveBeenCalledTimes(1)
    const [, , patch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(patch.cargoLots).toHaveLength(1)
    expect(patch.cargoLots?.[0]).toMatchObject({
      kind: 'unit',
      name: 'Sledge (Damaged)',
      cat: 'SYSTEM',
      units: 10,
      tl: 2,
    })
    // The exclusive jackpot claim is consumed — picker gone.
    expect(screen.queryByLabelText('Salvaged item')).toBeNull()
  })

  test('exhausted Supply disables the roll (hand-editable honor system)', async () => {
    restore = await patchReference()
    const { store } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(1)} />)

    const decrease = screen.getByRole('button', { name: 'Decrease supply' })
    for (let i = 0; i < 5; i++) fireEvent.click(decrease)

    const rollBtn = screen.getByRole('button', { name: 'Roll Area Salvage' })
    expect((rollBtn as HTMLButtonElement).disabled).toBe(true)

    // Stepping Supply back up re-enables it.
    fireEvent.click(screen.getByRole('button', { name: 'Increase supply' }))
    expect((rollBtn as HTMLButtonElement).disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mech Salvage
// ---------------------------------------------------------------------------

describe('SalvageControl — Mech Salvage (pp.245/248)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('2-5 auto-deposits half the chassis Salvage Value at its TL', async () => {
    restore = await patchReference()
    const { store, update } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(3)} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Wreck chassis'), { target: { value: 'mule' } })
      fireEvent.click(screen.getByRole('button', { name: 'Roll Mech Salvage' }))
    })

    // Mule: SV 7 → 3 Tech 1 Scrap (floor, min 1).
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      scrapPool: { tl2: 1, tl1: 3 },
    })
    expect(screen.getByRole('status').textContent).toContain('Nuts and Bolts')
  })

  test('20 auto-deposits the wreck chassis then claims one System AND one Module', async () => {
    restore = await patchReference()
    const { store, update } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(20)} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Wreck chassis'), { target: { value: 'mule' } })
      fireEvent.click(screen.getByRole('button', { name: 'Roll Mech Salvage' }))
    })

    // The chassis lot is mechanical bookkeeping — deposited without a pick.
    expect(update).toHaveBeenCalledTimes(1)
    const [, , chassisPatch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(chassisPatch.cargoLots?.[0]).toMatchObject({ name: 'Mule (Damaged)', units: 7 })

    // System pick.
    const select = screen.getByLabelText('Salvaged item') as HTMLSelectElement
    await act(async () => {
      fireEvent.change(select, { target: { value: 'system:red-laser' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add to hold' }))
    })
    const [, , systemPatch] = update.mock.calls[1] as [string, string, Partial<Crawler>]
    expect(systemPatch.cargoLots?.[0]).toMatchObject({ name: 'Red Laser (Damaged)', units: 3 })

    // Claim stays open for the Module pick…
    const select2 = screen.getByLabelText('Salvaged item') as HTMLSelectElement
    await act(async () => {
      fireEvent.change(select2, { target: { value: 'module:overdrive' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add to hold' }))
    })
    const [, , modulePatch] = update.mock.calls[2] as [string, string, Partial<Crawler>]
    expect(modulePatch.cargoLots?.[0]).toMatchObject({ name: 'Overdrive (Damaged)', units: 2 })

    // …then closes once both picks are taken.
    expect(screen.queryByLabelText('Salvaged item')).toBeNull()
  })

  test('11-19 offers the Chassis OR one item; taking the chassis consumes the claim', async () => {
    restore = await patchReference()
    const { store, update } = makeStubStore(fakeCrawler)
    render(<SalvageControl crawler={fakeCrawler} store={store} roll={seqRoll(15)} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Wreck chassis'), { target: { value: 'mule' } })
      fireEvent.click(screen.getByRole('button', { name: 'Roll Mech Salvage' }))
    })

    // Nothing auto-deposits on the OR band.
    expect(update).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take Mule chassis (Damaged)' }))
    })

    const [, , patch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(patch.cargoLots?.[0]).toMatchObject({ name: 'Mule (Damaged)', units: 7, tl: 1 })
    expect(screen.queryByLabelText('Salvaged item')).toBeNull()
  })
})
