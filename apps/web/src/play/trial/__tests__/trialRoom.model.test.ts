import { afterEach, describe, expect, test } from 'bun:test'
import { PLAY_TXN } from '../../../replica/provenance'
import { roomOf } from '../../../replica/roomSocket'
import { resetSync, writable } from '../../../replica/sync'
import { readTableState } from '../../../replica/tableState'
import { useUnits } from '../../../replica/units'
import { openTrial, trialChanged, trialCrew } from '../trialRoom.model'

/**
 * The signed-out trial's room (r6 F1): a book pilot and their mech held in the
 * tab, the seat's acts answered there, nothing sent and nothing left behind.
 */

afterEach(() => resetSync())

describe('the trial room', () => {
  test('only a book crew’s pilot has a trial, with the mech assigned to them', () => {
    expect(trialCrew('not-a-book-pilot')).toBeNull()
    const crew = trialCrew('starter-pilot-bonesaw')
    expect(crew?.pilot.name).toBe('Bonesaw')
    expect(crew?.mechs.map((m) => m.id)).toEqual(['starter-mech-scrapper'])
  })

  test('reopened untouched (as React’s dev double effect does), the round is still untouched', () => {
    const crew = trialCrew('starter-pilot-bonesaw')
    if (crew === null) throw new Error('no crew')
    openTrial(crew)()
    const close = openTrial(crew)
    expect(trialChanged()).toBe(false)
    close()
  })

  test('opens writable over the crew, takes a vital and a boarding, and leaves nothing', async () => {
    const crew = trialCrew('starter-pilot-bonesaw')
    if (crew === null) throw new Error('no crew')
    const close = openTrial(crew)
    expect(writable()).toBe(true)
    expect(useUnits.getState().get('pilot', crew.pilot.id)?.name).toBe('Bonesaw')
    expect(trialChanged()).toBe(false)

    await useUnits.getState().update('mech', 'starter-mech-scrapper', { currentHeat: 3 }, PLAY_TXN)
    expect(useUnits.getState().get('mech', 'starter-mech-scrapper')?.currentHeat).toBe(3)
    expect(trialChanged()).toBe(true)

    await roomOf(null)?.act('seats.board', {
      pilotId: crew.pilot.id,
      mechId: 'starter-mech-scrapper',
    })
    const seats = readTableState('account', 'seats') as { mount: { kind: string } }[]
    expect(seats[0]?.mount.kind).toBe('boarded')
    await expect(roomOf(null)?.act('downtime.begin', {}) ?? Promise.resolve()).rejects.toThrow(
      /Sign in/
    )

    close()
    expect(writable()).toBe(false)
    expect(roomOf(null)).toBeNull()
    expect(useUnits.getState().get('pilot', crew.pilot.id)).toBeNull()

    // Opened again in this tab, the round picks up where it was left.
    const again = openTrial(crew)
    expect(useUnits.getState().get('mech', 'starter-mech-scrapper')?.currentHeat).toBe(3)
    again()
  })
})
