/**
 * Tests for ActiveItemBand — the Active Item and its mount state machine.
 *
 * The gauges derive maxima from the reference ORM, so preload('all') runs once.
 * Mount transitions (Board / Dismount) are the only mutations in Phase 2.
 */

import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { usePlayStateStore } from '../../../stores/playStateStore'
import { ActiveItemBand } from '../ActiveItemBand'

const mech = {
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'unknown-chassis',
  systems: [],
  modules: [],
  cargoLots: [],
} as unknown as Mech

const pilot = {
  id: 'p1',
  name: 'Vesh',
  abilities: [],
  equipment: [],
  conditions: [],
} as unknown as Pilot

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('ActiveItemBand', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
  })

  test('boarded → shows the mech band and its bays', () => {
    render(<ActiveItemBand mech={mech} pilot={null} />)
    expect(screen.getByText('Mech · Iron Mongrel')).toBeTruthy()
    expect(screen.getByText('Reactor')).toBeTruthy()
    expect(screen.getByText('Chassis')).toBeTruthy()
  })

  test('Dismount is disabled when no pilot is assigned', () => {
    render(<ActiveItemBand mech={mech} pilot={null} />)
    expect((screen.getByText('Dismount') as HTMLButtonElement).disabled).toBe(true)
  })

  test('Dismount → pilot band, Board → back to the mech band', () => {
    render(<ActiveItemBand mech={mech} pilot={pilot} />)
    fireEvent.click(screen.getByText('Dismount'))
    expect(screen.getByText('Pilot · Vesh')).toBeTruthy()
    fireEvent.click(screen.getByText('▶ Board Mech'))
    expect(screen.getByText('Mech · Iron Mongrel')).toBeTruthy()
  })
})
