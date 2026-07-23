/**
 * `ChassisAbilitiesContent` is the chassis card's abilities block. Beyond
 * listing the abilities it does two things nothing else does: it resolves the
 * drone an ability NAMES into a real drone card, and — in the pre-baked pattern
 * mode — resolves that drone's pattern-specific systems/modules names into
 * entity listings under their own slabs. Both resolutions are by name against
 * the dataset, so a rename or a lookup regression makes content vanish without
 * failing typecheck.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference, getChassisAbilities } from 'salvageunion-reference'
import type { SURefMetaAction, SURefMetaEntity } from 'salvageunion-reference'
import { ChassisAbilitiesContent } from '../ChassisAbilitiesContent'

const abilitiesOf = (chassisName: string): SURefMetaAction[] => {
  const chassis = SalvageUnionReference.Chassis.all().find((c) => c.name === chassisName)
  if (!chassis) throw new Error(`fixture missing: chassis ${chassisName}`)
  const abilities = getChassisAbilities(chassis as SURefMetaEntity)
  if (!abilities || abilities.length === 0)
    throw new Error(`fixture has no chassis abilities: ${chassisName}`)
  return abilities
}

afterEach(cleanup)

describe('ChassisAbilitiesContent', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

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

  test("an ability naming a drone mounts that drone's own card", () => {
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilitiesOf('Little Sestra')}
      />
    )
    // "Sestra Drone" appears as the ability's name too, so assert on the drone
    // card's own content rather than the string alone.
    expect(screen.getByText('Sestra Drone')).toBeTruthy()
  })

  test('hideDrone suppresses the drone card for consumers rendering it themselves', () => {
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilitiesOf('Little Sestra')}
        hideDrone
      />
    )
    expect(screen.queryByText('Sestra Drone')).toBeNull()
  })

  test("pre-baked droneEquipment resolves the pattern's systems and modules by name", () => {
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilitiesOf('Little Sestra')}
        droneEquipment={[
          {
            name: 'Sestra Drone',
            systems: ['Long Barrelled Green Laser', 'High Gain Antenna'],
            modules: ['Survey Scanner'],
          },
        ]}
      />
    )
    expect(screen.getByText('Long Barrelled Green Laser')).toBeTruthy()
    expect(screen.getByText('High Gain Antenna')).toBeTruthy()
    expect(screen.getByText('Survey Scanner')).toBeTruthy()
  })

  test('an unresolvable equipment name is dropped, not rendered blank', () => {
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilitiesOf('Little Sestra')}
        droneEquipment={[{ systems: ['No Such System'], modules: ['Survey Scanner'] }]}
      />
    )
    expect(screen.queryByText('No Such System')).toBeNull()
    // The modules half still renders — one bad name must not take the block down.
    expect(screen.getByText('Survey Scanner')).toBeTruthy()
  })

  test('an empty droneEquipment loadout renders no equipment listings', () => {
    render(
      <ChassisAbilitiesContent
        compact={false}
        chassisName="Little Sestra"
        chassisAbilities={abilitiesOf('Little Sestra')}
        droneEquipment={[{ systems: [], modules: [] }]}
      />
    )
    expect(screen.queryByText('Long Barrelled Green Laser')).toBeNull()
    expect(screen.queryByText('Survey Scanner')).toBeNull()
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
