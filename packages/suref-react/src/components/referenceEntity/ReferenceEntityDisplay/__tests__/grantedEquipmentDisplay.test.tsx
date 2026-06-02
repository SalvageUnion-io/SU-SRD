import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'
import { EntityHrefProvider } from '../entityHrefContext'

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

  test('renders the weapon-type choice text in the content', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(
      screen.getByText(/Choose if your Custom Sniper Rifle is a Ballistic or Energy weapon/i)
    ).toBeTruthy()
  })

  test('shows the damage type (SP) after the damage value', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.getByText('SP')).toBeTruthy()
  })

  test('does not surface the linked action\'s "Pilot equipment" trait in the subtitle', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(screen.queryByText(/pilot equipment/i)).toBeNull()
  })

  test('renders the max-describing content text (when a Modification may be picked)', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(
      screen.getByText(/At each Tech Level, you may select an additional Modification/i)
    ).toBeTruthy()
  })

  test('does not duplicate the redundant pilot-equipment action (Damage shown once)', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    // The same-named pilot-equipment action card is suppressed for choice-bearing
    // equipment, so the base stats render only in the resolved row — not twice.
    expect(screen.getAllByText('Damage').length).toBe(1)
  })

  test('renders an unresolved Weapon Type prompt in the row (segmented chrome)', () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    // The prompt uses the class-style segmented chrome: [CHOOSE][Ballistic][OR][Energy].
    expect(screen.getByText('Choose')).toBeTruthy()
    expect(screen.getByText('OR')).toBeTruthy()
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
    // The segmented Weapon Type prompt disappears once resolved.
    expect(screen.queryByText('Choose')).toBeNull()
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
  test('shows the ability description in the header flavor slot', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(screen.getByText('Gain a specialised sniper rifle that only you can use.')).toBeTruthy()
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
    // The nested equipment surfaces the segmented weapon-type prompt + option cards.
    expect(screen.getByText('Choose')).toBeTruthy()
    // The Weapon Type / Modification choice groups render.
    expect(screen.getByText('Weapon Type')).toBeTruthy()
    expect(screen.getByText('Modification')).toBeTruthy()
  })

  test('grants are visible in compact mode, with the nested equipment collapsed to header-only', () => {
    render(<ReferenceEntityDisplay data={rifleAbility} compact />)
    expect(screen.getByText('Grants')).toBeTruthy()
    // The nested equipment renders header-only when the ability is compact, so
    // its interactive choice groups (body) are NOT shown.
    expect(screen.queryByText('Weapon Type')).toBeNull()
    expect(screen.queryByText('Modification')).toBeNull()
  })

  test('does not render an Actions section for the granting ability', () => {
    const { container } = render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(within(container).queryByText('Actions')).toBeNull()
  })

  test('nested equipment exposes a "View Details" control (opens the show page) and is not whole-card clickable', () => {
    // The View Details link comes from the app-provided EntityHrefProvider.
    render(
      <EntityHrefProvider value={() => '/schema/equipment/item/custom-sniper-rifle/'}>
        <ReferenceEntityDisplay data={rifleAbility} />
      </EntityHrefProvider>
    )
    const viewDetails = screen.getByRole('button', { name: /View Custom Sniper Rifle details/i })
    expect(viewDetails).toBeTruthy()
  })
})
