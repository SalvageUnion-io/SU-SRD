/**
 * Tests for ActiveItemBand — the Active Item and its mount state machine.
 *
 * The gauges derive maxima from the reference ORM, so preload('all') runs once.
 * Mount transitions (Board / Dismount) are the only mutations in Phase 2.
 */

import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { usePlayStateStore } from '../../../stores/playStateStore'
import { ActiveItemBand } from '../ActiveItemBand'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'unknown-chassis' })

const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })

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
    expect(screen.getByText<HTMLButtonElement>('Dismount').disabled).toBe(true)
  })

  test('Dismount → pilot band, Board → back to the mech band', () => {
    render(<ActiveItemBand mech={mech} pilot={pilot} />)
    fireEvent.click(screen.getByText('Dismount'))
    expect(screen.getByText('Pilot · Vesh')).toBeTruthy()
    fireEvent.click(screen.getByText('▶ Board Mech'))
    expect(screen.getByText('Mech · Iron Mongrel')).toBeTruthy()
  })
})
