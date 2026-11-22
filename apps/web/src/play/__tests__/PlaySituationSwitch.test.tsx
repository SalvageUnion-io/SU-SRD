/** A Down Mech on the Situation switch (r6 A7): Down, and where it is. */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { PlaySituationSwitch } from '../PlaySituationSwitch'
import type { Situation } from '../situation.model'
import { useHarnessPlay } from './playActionsHarness'

const pilot = pilotFixture({ id: 'p-down', name: 'Bonesaw', callsign: 'Bonesaw' })
const mech = (currentSP: number): Mech =>
  mechFixture({ id: 'm-down', name: 'Thresher', chassisRef: 'unknown-chassis', currentSP })

function Switch({ situation, sp }: { situation: Situation; sp: number }) {
  const play = useHarnessPlay({ pilot, mech: mech(sp), situation, writes: [] })
  return <PlaySituationSwitch play={play} downtimeMech={mech(sp)} />
}

describe('PlaySituationSwitch, a Down Mech', () => {
  test('boarded at 0 SP, it is Down in the field', () => {
    render(<Switch situation="boarded" sp={0} />)
    expect(screen.getByRole('button', { name: /Thresher is Down, in the field/ })).toBeTruthy()
  })

  test('in Downtime at 0 SP, it is Down in the Mech Bay', () => {
    render(<Switch situation="downtime" sp={0} />)
    expect(screen.getByRole('button', { name: /Thresher is Down, in the Mech Bay/ })).toBeTruthy()
  })

  test('with SP left, Board names the Mech', () => {
    render(<Switch situation="boarded" sp={3} />)
    expect(screen.queryByText(/is Down/)).toBeNull()
    expect(screen.getByRole('button', { name: /Boarded · Thresher/ })).toBeTruthy()
  })
})
