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

/** The side column's Chassis Ability groups, together. */
function abilityList(): HTMLElement {
  const groups = screen
    .getAllByText('Chassis ability')
    .map((label) => label.closest<HTMLElement>('section'))
    .filter((group): group is HTMLElement => group !== null)
  if (groups.length === 0) throw new Error('no Chassis Ability group')
  const all = document.createElement('div')
  for (const group of groups) all.append(group.cloneNode(true))
  return all
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
