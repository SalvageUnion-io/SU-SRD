/**
 * MechSheet — Chassis Modder (Fabricator level 3, Core Book p.64): a Mech
 * gains one added Chassis Ability while its Fabricator pilots it.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'

const FABRICATOR = ['chassis-modder']

function abilityList(): HTMLElement {
  return screen.getByRole('list', { name: /chassis ability/i })
}

describe('MechSheet — Chassis Modder', () => {
  test('the added ability shows beside the chassis ability for a Chassis Modder', () => {
    const mech = mechFixture({
      id: 'mech-modder-1',
      chassisRef: 'mule',
      moddedChassisAbility: 'fast',
    })
    render(
      <MechSheet
        mech={mech}
        store={makeSingleUnitStore('mech', mech)}
        pilotAbilities={FABRICATOR}
      />
    )
    const list = abilityList()
    expect(within(list).getAllByText(/Integrated Cargo Bay/).length).toBeGreaterThan(0)
    expect(within(list).getAllByText(/^Fast$/).length).toBeGreaterThan(0)
    expect(within(list).getAllByText(/Chassis Modder/).length).toBeGreaterThan(0)
  })

  test('another pilot does not get the added ability', () => {
    const mech = mechFixture({
      id: 'mech-modder-1',
      chassisRef: 'mule',
      moddedChassisAbility: 'fast',
    })
    render(<MechSheet mech={mech} store={makeSingleUnitStore('mech', mech)} pilotAbilities={[]} />)
    expect(within(abilityList()).queryByText(/^Fast$/)).toBeNull()
    expect(screen.queryByRole('button', { name: /add chassis ability/i })).toBeNull()
  })

  test('a Chassis Modder can add one in Edit, never on a read-only sheet', () => {
    const mech = mechFixture({ id: 'mech-modder-1', chassisRef: 'mule' })
    const { unmount } = render(
      <MechSheet
        mech={mech}
        store={makeSingleUnitStore('mech', mech)}
        pilotAbilities={FABRICATOR}
      />
    )
    expect(screen.getByRole('button', { name: /add chassis ability/i })).toBeTruthy()
    unmount()
    render(
      <MechSheet
        mech={mech}
        store={makeSingleUnitStore('mech', mech)}
        pilotAbilities={FABRICATOR}
        readOnly
      />
    )
    expect(screen.queryByRole('button', { name: /add chassis ability/i })).toBeNull()
  })
})
