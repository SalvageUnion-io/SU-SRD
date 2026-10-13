/**
 * `ChassisAbilitiesContent` is the chassis pattern card's abilities block: one
 * inline card per chassis ability.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { SURefMetaAction, SURefMetaEntity } from 'salvageunion-reference'
import { getChassisAbilities, SalvageUnionReference } from 'salvageunion-reference'
import { ChassisAbilitiesContent } from '../ChassisAbilitiesContent'

const abilitiesOf = (chassisName: string): SURefMetaAction[] => {
  const chassis = SalvageUnionReference.Chassis.getByName(chassisName)
  if (!chassis) throw new Error(`fixture missing: chassis ${chassisName}`)
  const abilities = getChassisAbilities(chassis as SURefMetaEntity)
  if (!abilities || abilities.length === 0)
    throw new Error(`fixture has no chassis abilities: ${chassisName}`)
  return abilities
}

describe('ChassisAbilitiesContent', () => {
  test('renders nothing when the chassis has no abilities', () => {
    const { container } = render(<ChassisAbilitiesContent compact={false} />)
    expect(container.innerHTML).toBe('')
    cleanup()
    const empty = render(<ChassisAbilitiesContent compact={false} chassisAbilities={[]} />)
    expect(empty.container.innerHTML).toBe('')
  })

  test('renders a card for each ability', () => {
    const abilities = abilitiesOf('Little Sestra')
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilities}
      />
    )
    for (const ability of abilities) {
      expect(screen.getAllByText(ability.name as string).length).toBeGreaterThan(0)
    }
  })

  test('an unknown chassis name still renders the abilities (no host tone to ghost)', () => {
    render(
      <ChassisAbilitiesContent
        compact
        chassisName="No Such Chassis"
        chassisAbilities={abilitiesOf('Little Sestra')}
      />
    )
    expect(screen.getAllByText('Sestra Drone Controller').length).toBeGreaterThan(0)
  })
})
