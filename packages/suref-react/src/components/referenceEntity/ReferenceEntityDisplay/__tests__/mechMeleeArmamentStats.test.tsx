import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Regression: the Mech Melee Armament System carries its stats (Range/Damage/
 * Traits) and a freeform "describe the weapon" choice on a same-named action,
 * not as a root `datavalues` block. The choice flips the display into the
 * resolved-data-row path (used by granted equipment like the Custom Sniper
 * Rifle), which only reads root datavalues/traits — so the stats used to vanish,
 * leaving an empty data block (seen on e.g. the Brawler "Gladiator Pattern").
 * The resolved data row now seeds its base stats from the matching action.
 */
const meleeArmament = SalvageUnionReference.Systems.find((s) => s.name === 'Mech Melee Armament')
// A sibling matching-action-choice System with no Range/Damage/Traits — guards
// against the fix surfacing spurious stats where there are none.
const bodyKit = SalvageUnionReference.Systems.find((s) => s.name === 'Industrial Body Kit')

afterEach(() => cleanup())

describe('Mech Melee Armament resolved data row', () => {
  test('fixtures resolve', () => {
    expect(meleeArmament).toBeDefined()
    expect(bodyKit).toBeDefined()
  })

  test('renders Damage 5 SP from the matching action', () => {
    render(<ReferenceEntityDisplay data={meleeArmament} compact />)
    expect(screen.getByText('Damage')).toBeTruthy()
    expect(screen.getByText('SP')).toBeTruthy()
  })

  test('renders Range Close from the matching action', () => {
    render(<ReferenceEntityDisplay data={meleeArmament} compact />)
    expect(screen.getByText('Range')).toBeTruthy()
    expect(screen.getByText('Close')).toBeTruthy()
  })

  test('renders the Melee and Wield traits from the matching action', () => {
    render(<ReferenceEntityDisplay data={meleeArmament} compact />)
    expect(screen.getByText(/^melee$/i)).toBeTruthy()
    expect(screen.getByText(/^wield$/i)).toBeTruthy()
  })

  test('a sibling matching-action-choice System with no stats shows no Damage/Range', () => {
    render(<ReferenceEntityDisplay data={bodyKit} compact />)
    expect(screen.queryByText('Damage')).toBeNull()
    expect(screen.queryByText('Range')).toBeNull()
  })
})
