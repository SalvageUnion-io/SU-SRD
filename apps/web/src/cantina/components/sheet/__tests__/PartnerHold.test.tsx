/**
 * PartnerHold — a partner's cargo hold and its boundary with the crawler
 * Storage Bay.
 *
 * Pins which moves are offered and when they are closed (no crawler, a
 * mediator-kept crawler, a full hold), that each button dispatches its own
 * move on its own lot, that a refused move says why instead of doing nothing,
 * and that a read-only sheet offers no moves at all.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { CargoLot } from 'cantina-domain/schemas/cargoLot'
import { Toaster, toast } from 'component-lib'
import type { CargoTransferResult } from '../../../lib/cargo/cargoTransfer'
import type { UsePartnerCargoResult } from '../../../lib/cargo/usePartnerCargo'
import { PartnerHold } from '../PartnerHold'

const CRATE: CargoLot = {
  id: 'lot-crate',
  kind: 'unit',
  name: 'Sealed Crate',
  cat: 'SEALED',
  units: 1,
  code: 'SEA',
}
const CELL: CargoLot = {
  id: 'lot-cell',
  kind: 'unit',
  name: 'Power Cell',
  cat: 'POWER',
  units: 2,
  code: 'POW',
}

type Moves = Pick<UsePartnerCargoResult, 'stow' | 'load' | 'removeLot' | 'addLot'>

function okResult(): CargoTransferResult {
  return {
    ok: true,
    state: { carrierLots: [], carrierCargoCap: 3, depotLots: [], scrapPool: {} },
    changed: { carrier: true, depot: true },
  }
}

function makeCargo(
  overrides: {
    carried?: CargoLot[]
    depot?: CargoLot[]
    cap?: number
    crawlerLocked?: string | null
  } & Partial<Moves> = {}
): UsePartnerCargoResult {
  const carried = overrides.carried ?? [CRATE]
  const cap = overrides.cap ?? 3
  const used = carried.reduce((n, l) => n + l.units, 0)
  return {
    state: {
      carrierLots: carried,
      carrierCargoCap: cap,
      depotLots: overrides.depot ?? [CELL],
      scrapPool: {},
    },
    crawlerLocked: overrides.crawlerLocked ?? null,
    usage: { used, cap, free: Math.max(0, cap - used), over: used > cap },
    stow: overrides.stow ?? mock(async () => okResult()),
    load: overrides.load ?? mock(async () => okResult()),
    addLot: overrides.addLot ?? mock(async () => okResult()),
    removeLot: overrides.removeLot ?? mock(async () => okResult()),
  }
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

function lotRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li')
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

// A mounting Toaster replays every toast still active from earlier files.
beforeEach(() => {
  toast.dismiss()
})
afterEach(() => {
  toast.dismiss()
})

describe('PartnerHold — moves', () => {
  test('Stow, Unload and Load each dispatch their own move on their own lot', async () => {
    const cargo = makeCargo()
    render(<PartnerHold cargo={cargo} crawlerLinked />)

    expect(screen.getByText('Carried')).toBeTruthy()
    expect(screen.getByText('Storage Bay')).toBeTruthy()

    await click(within(lotRow('Sealed Crate')).getByRole('button', { name: 'Stow →' }))
    expect(cargo.stow).toHaveBeenCalledWith('lot-crate')

    await click(within(lotRow('Sealed Crate')).getByRole('button', { name: 'Unload' }))
    expect(cargo.removeLot).toHaveBeenCalledWith('lot-crate')

    await click(within(lotRow('Power Cell')).getByRole('button', { name: '← Load' }))
    expect(cargo.load).toHaveBeenCalledWith('lot-cell')
  })

  test('a refused move says why', async () => {
    const cargo = makeCargo({
      removeLot: mock(async () => ({ ok: false as const, reason: 'The save did not land.' })),
    })
    render(
      <>
        <Toaster />
        <PartnerHold cargo={cargo} crawlerLinked />
      </>
    )
    await click(screen.getByRole('button', { name: 'Unload' }))
    expect(await screen.findByText('The save did not land.')).toBeTruthy()
  })
})

describe('PartnerHold — closed moves', () => {
  test('with no crawler, Stow is closed and the Storage Bay is not shown', () => {
    render(<PartnerHold cargo={makeCargo()} crawlerLinked={false} />)
    const stow = screen.getByRole('button', { name: 'Stow →' })
    expect(stow.hasAttribute('disabled')).toBe(true)
    expect(stow.getAttribute('title')).toBe('No crawler is assigned.')
    // Unload needs no crawler.
    expect(screen.getByRole('button', { name: 'Unload' }).hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText('Storage Bay')).toBeNull()
  })

  test('a mediator-kept crawler closes Stow and Load, and says so', () => {
    const why = 'The Mediator keeps this crawler.'
    render(<PartnerHold cargo={makeCargo({ crawlerLocked: why })} crawlerLinked />)
    expect(screen.getByText(why)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stow →' }).getAttribute('title')).toBe(why)
    const load = screen.getByRole('button', { name: '← Load' })
    expect(load.hasAttribute('disabled')).toBe(true)
    expect(load.getAttribute('title')).toBe(why)
  })

  test('a full hold closes Load', () => {
    render(<PartnerHold cargo={makeCargo({ cap: 1 })} crawlerLinked />)
    const load = screen.getByRole('button', { name: '← Load' })
    expect(load.hasAttribute('disabled')).toBe(true)
    expect(load.getAttribute('title')).toBe('The hold is full.')
  })

  test('empty sides say they are empty', () => {
    render(<PartnerHold cargo={makeCargo({ carried: [], depot: [] })} crawlerLinked />)
    expect(screen.getByText('Nothing carried.')).toBeTruthy()
    expect(screen.getByText('The Storage Bay is empty.')).toBeTruthy()
  })

  test('read-only shows the lots and offers no moves', () => {
    render(<PartnerHold cargo={makeCargo({ crawlerLocked: 'kept' })} crawlerLinked readOnly />)
    expect(screen.getByText('Sealed Crate')).toBeTruthy()
    expect(screen.getByText('Power Cell')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    // The lock note is an editing hint; a read-only viewer is not editing.
    expect(screen.queryByText('kept')).toBeNull()
  })
})
