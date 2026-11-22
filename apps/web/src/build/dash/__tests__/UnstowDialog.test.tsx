/**
 * Unstow asks first (r5 B4): how many of a stack, and where they go, onto the
 * docked Mech while it has room, or out of the Storage Bay.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { UnstowTo } from '../UnstowDialog'
import { UnstowDialog } from '../UnstowDialog'

const crates: CargoLot = {
  id: 'lot-crates',
  kind: 'bulk',
  name: 'Ration Crates',
  cat: 'SEALED',
  qty: 6,
  units: 6,
  code: 'RAT',
}

function open(mechName: string | null, fits: number) {
  const said: [number, UnstowTo][] = []
  render(
    <UnstowDialog
      lot={crates}
      mechName={mechName}
      fits={fits}
      onClose={() => {}}
      onUnstow={(qty, to) => said.push([qty, to])}
    />
  )
  return said
}

describe('UnstowDialog', () => {
  test('onto the docked Mech by default, never more than its hold has room for', () => {
    const said = open('Mule', 4)
    const onto = screen.getByRole('radio', { name: /Onto Mule’s hold/ })
    expect((onto as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Unstow 4' }))
    expect(said).toEqual([[4, 'mech']])
  })

  test('with no Mech docked, only out of the bay, the whole stack by default', () => {
    const said = open(null, 0)
    const onto = screen.getByRole('radio', { name: /Onto the docked Mech’s hold/ })
    expect((onto as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Unstow 6' }))
    expect(said).toEqual([[6, 'out']])
  })
})
