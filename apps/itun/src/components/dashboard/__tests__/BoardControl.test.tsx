/**
 * The Board control in the Pilot Major's Mount bay: the split button and the
 * mech menu its ▾ opens (docs/architecture/dashboard-redesign.md D4; #1055).
 *
 * The menu's contents are `boardMenu.ts`'s, tested on their own in
 * `boardMenu.test.ts`; this drives what a player presses, and records what
 * reaches the seat with `fakeSeat`.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import type { BoardMenu, BoardOption } from '../boardMenu'
import { SlotRow } from '../SlotRow'
import type { SeatHandle } from '../useSeat'
import { fakeSeat } from './seatFixture'

const pilot = pilotFixture({ id: 'p1', name: 'Rook' })
const thresher = mechFixture({ id: 'thresher', name: 'Thresher', chassisRef: 'unknown' })

function opt(mechId: string, state: BoardOption['state'], note: string | null = null): BoardOption {
  return { mechId, serverId: `row-${mechId}`, name: mechId, state, note }
}

const yours = { ...opt('thresher', 'yours'), name: 'Thresher' }
const spare = opt('Spare', 'spare', 'Unclaimed spare')
const others = opt('Hauler', 'others', 'Another player’s mech')
const wreck = opt('Wreck', 'destroyed', 'Destroyed')
const aboard = opt('Lancer', 'aboard', 'Vex is aboard')

function renderBoard(board: BoardMenu, mech = thresher as typeof thresher | null) {
  const { handle, calls } = fakeSeat()
  render(
    <SlotRow
      mech={mech}
      pilot={pilot}
      crawler={null}
      boarded={false}
      seat={handle satisfies SeatHandle}
      board={board}
      mediator={false}
      mount="pilot"
      onExpand={() => {}}
    />
  )
  return calls
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Choose a mech to board' }))
  return screen.getByRole('dialog', { name: 'Board a mech' })
}

describe('the main half', () => {
  test('boards the assigned mech', () => {
    const calls = renderBoard({ main: yours, options: [yours] })
    fireEvent.click(screen.getByRole('button', { name: '▶ Board Thresher' }))
    expect(calls).toEqual([{ write: 'board', args: ['thresher'] }])
  })

  test('assigned mech destroyed: disabled, with the reason, and ▾ still offers spares', () => {
    const destroyed = { ...yours, state: 'destroyed' as const, note: 'Destroyed' }
    const calls = renderBoard({ main: destroyed, options: [destroyed, spare] })
    const main = screen.getByRole('button', { name: '▶ Board Thresher' })
    expect(main.hasAttribute('disabled')).toBe(true)
    expect(main.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(main.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Destroyed'
    )
    const menu = openMenu()
    expect(
      within(menu).getByRole('button', { name: 'Claim and board Spare' }).hasAttribute('disabled')
    ).toBe(false)
    expect(calls).toEqual([])
  })

  test('assigned mech aboard by another seat: disabled, naming who', () => {
    const taken = { ...yours, state: 'aboard' as const, note: 'Vex is aboard' }
    renderBoard({ main: taken, options: [taken] })
    expect(screen.getByRole('button', { name: '▶ Board Thresher' }).hasAttribute('disabled')).toBe(
      true
    )
    expect(screen.getByText('Vex is aboard')).toBeTruthy()
  })

  test('no assigned mech: one "Board a mech ▾" that opens the menu', () => {
    renderBoard({ main: null, options: [spare] }, null)
    expect(screen.queryByRole('button', { name: /▶ Board/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Board a mech ▾' }))
    expect(screen.getByRole('dialog', { name: 'Board a mech' })).toBeTruthy()
    // The Mech Minor says there is none, rather than the Dashboard refusing.
    expect(screen.getByText('No mech. Board one from the Pilot’s Mount bay.')).toBeTruthy()
  })
})

describe('the ▾ menu', () => {
  test('one disabled row per reason, each with the reason shown', () => {
    renderBoard({ main: yours, options: [yours, spare, others, wreck, aboard] })
    const menu = openMenu()
    for (const [name, reason] of [
      ['Hauler', 'Another player’s mech'],
      ['Wreck', 'Destroyed'],
      ['Lancer', 'Vex is aboard'],
    ] as const) {
      const button = within(menu).getByRole('button', { name })
      expect(button.hasAttribute('disabled')).toBe(true)
      const note = document.getElementById(button.getAttribute('aria-describedby') ?? '')
      expect(note?.textContent).toBe(reason)
    }
  })

  test('focus moves to the first mech that can be boarded, and Escape hands it back to ▾', () => {
    renderBoard({ main: yours, options: [wreck, yours] })
    const caret = screen.getByRole('button', { name: 'Choose a mech to board' })
    caret.focus()
    const menu = openMenu()
    expect(document.activeElement).toBe(
      within(menu).getByRole('button', { name: 'Board Thresher' })
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog', { name: 'Board a mech' })).toBeNull()
    expect(document.activeElement).toBe(caret)
  })

  test('your own mech boards from the menu', () => {
    const calls = renderBoard({ main: yours, options: [yours] })
    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Board Thresher' }))
    expect(calls).toEqual([{ write: 'board', args: ['thresher'] }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('a spare asks first, then claims and boards', () => {
    const calls = renderBoard({ main: yours, options: [yours, spare] })
    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Claim and board Spare' }))
    // The confirm step: nothing is written yet.
    const confirm = screen.getByRole('dialog', { name: 'Claim and board' })
    expect(within(confirm).getByText(/doesn’t assign it to Rook/)).toBeTruthy()
    expect(calls).toEqual([])

    fireEvent.click(within(confirm).getByRole('button', { name: 'Claim and board Spare' }))
    expect(calls).toEqual([
      { write: 'claimAndBoard', args: [{ mechId: 'Spare', serverId: 'row-Spare' }] },
    ])
  })

  test('closing the confirm claims nothing', () => {
    const calls = renderBoard({ main: yours, options: [spare] })
    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Claim and board Spare' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Claim and board' })).getByRole('button', {
        name: 'Close',
      })
    )
    expect(calls).toEqual([])
  })

  test('nothing to board says so', () => {
    renderBoard({ main: null, options: [] }, null)
    fireEvent.click(screen.getByRole('button', { name: 'Board a mech ▾' }))
    expect(screen.getByText('No mechs to board. Assign one on the pilot’s sheet.')).toBeTruthy()
  })
})
