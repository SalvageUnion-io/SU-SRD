/**
 * Tests for ActiveItemBand — the Active Item for each mount.
 *
 * The gauges derive maxima from the reference ORM, so preload('all') runs once.
 * The mount comes from the pilot's seat; the band only sends Board, Dismount
 * and Eject to it, recorded here by `fakeSeat`.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { ActiveItemBand } from '../ActiveItemBand'
import { boardedSeat, fakeSeat } from './seatFixture'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'unknown-chassis' })

const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })

describe('ActiveItemBand', () => {
  // The band's stamp carries the MOUNT STATE, not the entity name: the rail
  // above it already stamps the identity, and the two used to render the same
  // string twice, ~40px apart. See ActiveItemBandModel.stampLabel.
  test('boarded → shows the mech band and its bays', () => {
    const { handle } = boardedSeat(mech.id)
    render(<ActiveItemBand mech={mech} pilot={null} mount="mech" seat={handle} />)
    expect(screen.getByText('Boarded')).toBeTruthy()
    expect(screen.getByText('Reactor')).toBeTruthy()
    expect(screen.getByText('Chassis')).toBeTruthy()
  })

  test('Dismount is disabled when no pilot is assigned', () => {
    const { handle } = boardedSeat(mech.id)
    render(<ActiveItemBand mech={mech} pilot={null} mount="mech" seat={handle} />)
    expect(screen.getByText<HTMLButtonElement>('Dismount').disabled).toBe(true)
  })

  test('Dismount is sent to the seat', () => {
    const { handle, calls } = boardedSeat(mech.id)
    render(<ActiveItemBand mech={mech} pilot={pilot} mount="mech" seat={handle} />)
    fireEvent.click(screen.getByText('Dismount'))
    expect(calls).toEqual([{ write: 'dismount', args: [] }])
  })

  test('on foot → the pilot band, whose Board boards the mech it was given', () => {
    const { handle, calls } = fakeSeat()
    render(<ActiveItemBand mech={mech} pilot={pilot} mount="pilot" seat={handle} />)
    expect(screen.getByText('On Foot')).toBeTruthy()
    fireEvent.click(screen.getByText('▶ Board Mech'))
    expect(calls).toEqual([{ write: 'board', args: ['m1'] }])
  })
})
