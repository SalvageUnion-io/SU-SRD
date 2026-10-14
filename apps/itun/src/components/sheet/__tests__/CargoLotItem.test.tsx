/**
 * One lot in The Hold, on either side of the mech ⇄ crawler boundary.
 *
 *  - The crawler's Storage Bay tile: its tag (×N for bulk, TL for scrap, U
 *    otherwise), a cap-checked **← Load** that partial-fills a bulk lot to the
 *    mech's free slots and refuses what does not fit with the reason, and
 *    **Unstow**.
 *  - The mech chit: **Stow →**, closed with a reason when no crawler is linked,
 *    and **Unload**.
 *  - Read-only, no move or remove at all; a refused move is said as a toast.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Toaster, toast } from 'component-lib'
import type { CargoLot } from 'itun-domain/schemas/cargoLot'
import type { CargoTransferResult } from '../../../lib/cargo/cargoTransfer'
import type { UseCargoResult } from '../../../lib/cargo/useCargo'
import type { StorageManifestSide } from '../CargoLotItem'
import { CargoLotItem } from '../CargoLotItem'

const scrap: CargoLot = {
  id: 'lot-scrap',
  kind: 'bulk',
  name: 'T2 Scrap',
  cat: 'SCRAP',
  tl: 2,
  qty: 6,
  units: 6,
  code: 'T2',
}

const crate: CargoLot = {
  id: 'lot-crate',
  kind: 'unit',
  name: 'Sealed Crate',
  cat: 'SEALED',
  units: 3,
  code: 'SEA',
}

const relic: CargoLot = {
  id: 'lot-relic',
  kind: 'unit',
  name: 'Circuitry',
  cat: 'SCRAP',
  tl: 3,
  units: 1,
  code: 'CIR',
}

type Move = { move: 'stow' | 'load'; lotId: string }

function cargoWith({
  free = 10,
  locked = null,
  outcome = { ok: true, state: {}, changed: { carrier: true, depot: true } },
}: {
  free?: number
  locked?: string | null
  outcome?: CargoTransferResult | Record<string, unknown>
} = {}) {
  const moves: Move[] = []
  const answer = async () => outcome as CargoTransferResult
  const cargo = {
    crawlerLocked: locked,
    usage: { used: 0, cap: free, free, over: false },
    stow: async (lotId: string) => {
      moves.push({ move: 'stow', lotId })
      return answer()
    },
    load: async (lotId: string) => {
      moves.push({ move: 'load', lotId })
      return answer()
    },
  } as unknown as UseCargoResult
  return { cargo, moves }
}

async function renderLot({
  lot,
  side,
  cargo = cargoWith().cargo,
  linked = true,
  readOnly = false,
  onRemove,
}: {
  lot: CargoLot
  side: StorageManifestSide
  cargo?: UseCargoResult
  linked?: boolean
  readOnly?: boolean
  onRemove?: () => void
}) {
  await act(async () => {
    render(
      <>
        <ul>
          <CargoLotItem
            lot={lot}
            side={side}
            cargo={cargo}
            linked={linked}
            readOnly={readOnly}
            onRemove={onRemove}
          />
        </ul>
        <Toaster />
      </>
    )
  })
  return within(screen.getByRole('listitem'))
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

beforeEach(() => {
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

describe("the crawler's Storage Bay tile", () => {
  test('a bulk lot reads ×N, and loads whole when it fits', async () => {
    const { cargo, moves } = cargoWith({ free: 10 })
    const tile = await renderLot({ lot: scrap, side: 'crawler', cargo })
    expect(tile.getByText('T2 Scrap')).toBeTruthy()
    expect(tile.getByText('×')).toBeTruthy()
    const load = tile.getByRole('button', { name: 'Load T2 Scrap' })
    expect(load.textContent).toBe('← Load')
    expect((load as HTMLButtonElement).disabled).toBe(false)
    await click(load)
    expect(moves).toEqual([{ move: 'load', lotId: 'lot-scrap' }])
  })

  test('a bulk lot that only partly fits offers to load what does', async () => {
    const tile = await renderLot({
      lot: scrap,
      side: 'crawler',
      cargo: cargoWith({ free: 4 }).cargo,
    })
    expect(tile.getByRole('button', { name: 'Load T2 Scrap' }).textContent).toBe('← Load 4')
  })

  test('a lot that does not fit is refused with the free slots named', async () => {
    const tile = await renderLot({
      lot: crate,
      side: 'crawler',
      cargo: cargoWith({ free: 2 }).cargo,
    })
    expect(tile.getByText('U')).toBeTruthy()
    const load = tile.getByRole('button', { name: 'Load Sealed Crate' }) as HTMLButtonElement
    expect(load.disabled).toBe(true)
    expect(load.title).toBe('"Sealed Crate" does not fit — 2 slots free.')
    expect(load.textContent).toBe('← Load')
  })

  test('a unit scrap lot reads its Tech Level', async () => {
    const tile = await renderLot({ lot: relic, side: 'crawler' })
    expect(tile.getByText('TL')).toBeTruthy()
    expect(tile.getByText('3')).toBeTruthy()
  })

  test('with no mech docked, Load is closed and says why', async () => {
    const tile = await renderLot({ lot: scrap, side: 'crawler', linked: false })
    const load = tile.getByRole('button', { name: 'Load T2 Scrap' }) as HTMLButtonElement
    expect(load.disabled).toBe(true)
    expect(load.title).toBe('No mech assigned — nothing to load onto.')
  })

  test("a crawler the viewer may not write closes Load with the lock's reason", async () => {
    const { cargo } = cargoWith({ locked: "Only the Mediator moves the Game's crawler cargo." })
    const tile = await renderLot({ lot: scrap, side: 'crawler', cargo })
    const load = tile.getByRole('button', { name: 'Load T2 Scrap' }) as HTMLButtonElement
    expect(load.disabled).toBe(true)
    expect(load.title).toBe("Only the Mediator moves the Game's crawler cargo.")
  })

  test('Unstow drops it from the bay', async () => {
    let removed = 0
    const tile = await renderLot({ lot: scrap, side: 'crawler', onRemove: () => (removed += 1) })
    await click(tile.getByRole('button', { name: 'Unstow T2 Scrap' }))
    expect(removed).toBe(1)
  })

  test('read-only, the tile has no buttons', async () => {
    const tile = await renderLot({
      lot: scrap,
      side: 'crawler',
      readOnly: true,
      onRemove: () => {},
    })
    expect(tile.queryAllByRole('button')).toHaveLength(0)
  })

  test('a refused load is said as a toast', async () => {
    const { cargo } = cargoWith({ outcome: { ok: false, reason: 'The mech hold is full.' } })
    const tile = await renderLot({ lot: scrap, side: 'crawler', cargo })
    await click(tile.getByRole('button', { name: 'Load T2 Scrap' }))
    expect(await screen.findByText('The mech hold is full.')).toBeTruthy()
  })
})

describe("the mech hold's chit", () => {
  test('reads kind, quantity, category, Tech Level and code; Stow sends it to the crawler', async () => {
    const { cargo, moves } = cargoWith()
    const chit = await renderLot({ lot: scrap, side: 'mech', cargo })
    expect(chit.getByText('Bulk')).toBeTruthy()
    expect(chit.getByText('×6')).toBeTruthy()
    expect(chit.getByText(/SCRAP T2 · T2/)).toBeTruthy()
    const stow = chit.getByRole('button', { name: 'Stow T2 Scrap' })
    expect(stow.textContent).toBe('Stow →')
    await click(stow)
    expect(moves).toEqual([{ move: 'stow', lotId: 'lot-scrap' }])
  })

  test('with no crawler linked, Stow is closed and says why; Unload still works', async () => {
    let removed = 0
    const chit = await renderLot({
      lot: crate,
      side: 'mech',
      linked: false,
      onRemove: () => (removed += 1),
    })
    expect(chit.getByText('Unit')).toBeTruthy()
    const stow = chit.getByRole('button', { name: 'Stow Sealed Crate' }) as HTMLButtonElement
    expect(stow.disabled).toBe(true)
    expect(stow.title).toBe('No crawler assigned — nothing to stow to.')
    await click(chit.getByRole('button', { name: 'Unload Sealed Crate' }))
    expect(removed).toBe(1)
  })

  test('read-only, the chit has no buttons', async () => {
    const chit = await renderLot({ lot: crate, side: 'mech', readOnly: true, onRemove: () => {} })
    expect(chit.queryAllByRole('button')).toHaveLength(0)
  })
})
