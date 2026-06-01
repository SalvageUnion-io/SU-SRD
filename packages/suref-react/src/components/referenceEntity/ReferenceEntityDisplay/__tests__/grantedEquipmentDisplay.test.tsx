import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Phase 4 display-rewire integration tests, driven by the real Custom Sniper
 * Rifle equipment + ability:
 *  - equipment renders the resolved dataview row + interactive choice cards,
 *    recomputing live on toggle, with the old static choices section gone;
 *  - the granting ability suppresses its own description + Actions and instead
 *    renders the equipment lead line + a `Grants` block.
 */

const rifleEquipment = SalvageUnionReference.Equipment.find((e) => e.name === 'Custom Sniper Rifle')
const rifleAbility = SalvageUnionReference.Abilities.find((e) => e.name === 'Custom Sniper Rifle')

afterEach(() => cleanup())

describe('Custom Sniper Rifle equipment display', () => {
  test('fixtures resolve', () => {
    expect(rifleEquipment).toBeDefined()
    expect(rifleAbility).toBeDefined()
  })

  test('renders the resolved base dataview row (Damage 2 / Range Long)', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.getByText('Damage')).toBeTruthy()
    // base Range is Long until Rangefinder is selected
    expect(screen.getByText('Long')).toBeTruthy()
  })

  test('renders an unresolved Weapon Type prompt in the row', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.getByText(/Choose:.*Ballistic.*or.*Energy/i)).toBeTruthy()
  })

  test('renders interactive choice cards (Weapon Type + Modification)', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.getByRole('button', { name: /Ballistic/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Energy/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Rangefinder/ })).toBeTruthy()
  })

  test('selecting Ballistic removes the prompt and adds the Ballistic trait to the row', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    expect(screen.queryByText(/Choose:.*Ballistic.*or.*Energy/i)).toBeNull()
    // The trait now appears in the resolved row (in addition to the option card).
    expect(screen.getAllByText('Ballistic').length).toBeGreaterThan(1)
  })

  test('selecting Rangefinder bumps Range to Far in the resolved row', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.getByText('Long')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Rangefinder/ }))
    expect(screen.getByText('Far')).toBeTruthy()
    expect(screen.queryByText('Long')).toBeNull()
  })
})

describe('Custom Sniper Rifle granting ability display', () => {
  test('suppresses the ability description', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(screen.queryByText('Gain a specialised sniper rifle that only you can use.')).toBeNull()
  })

  test('renders the equipment lead line once', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    const lead = screen.getAllByText(/You acquire and train in the use of a Custom Sniper Rifle/i)
    expect(lead.length).toBe(1)
  })

  test('renders a Grants divider', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(screen.getByText('Grants')).toBeTruthy()
  })

  test('renders the nested equipment with its resolved row + choice cards', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    // The nested equipment surfaces the weapon-type prompt + option cards.
    expect(screen.getByText(/Choose:.*Ballistic.*or.*Energy/i)).toBeTruthy()
    // The Weapon Type / Modification choice groups render.
    expect(screen.getByText('Weapon Type')).toBeTruthy()
    expect(screen.getByText('Modification')).toBeTruthy()
  })

  test('grants are visible in compact mode', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} compact />)
    expect(screen.getByText('Grants')).toBeTruthy()
    // The nested equipment's interactive choice cards render in compact too.
    expect(screen.getByText('Weapon Type')).toBeTruthy()
  })

  test('does not render an Actions section for the granting ability', () => {
    const { container } = render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(within(container).queryByText('Actions')).toBeNull()
  })
})
