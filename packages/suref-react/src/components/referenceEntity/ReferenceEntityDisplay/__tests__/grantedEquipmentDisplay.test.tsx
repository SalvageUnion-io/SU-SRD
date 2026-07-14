import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { SalvageUnionReference, getChoices } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
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
const weaponTypeChoiceId =
  (rifleEquipment
    ? getChoices(rifleEquipment)?.find((c) => c.name === 'Weapon Type')?.id
    : undefined) ?? ''

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

  test("renders the lead intro line on the equipment's own (non-nested) page", () => {
    render(<ReferenceEntityDisplay data={rifleEquipment} compact />)
    expect(
      screen.getByText(/You acquire and train in the use of a Custom Sniper Rifle/i)
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

  test('hides the equipment lead intro when nested, but keeps its other content', () => {
    // "shows in a granted prompt" === lead: the intro shows on the equipment's own
    // page (tested above) but is hidden when nested — it duplicates the ability's
    // own description. Non-lead content (the modification note) still renders.
    render(<ReferenceEntityDisplay data={rifleAbility} />)
    expect(
      screen.queryByText(/You acquire and train in the use of a Custom Sniper Rifle/i)
    ).toBeNull()
    expect(
      screen.getByText(/At each Tech Level, you may select an additional Modification/i)
    ).toBeTruthy()
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

  test('expandGrants renders the granted equipment as a full compact card (choice cards shown)', () => {
    // The ITUN live sheet opts in via `expandGrants` so a compact granting ability
    // shows its granted equipment as a proper full entity display — the same body
    // (resolved row + interactive choice cards) it shows on its own reference page,
    // rather than the header-only collapse the dense reference listings use.
    render(<ReferenceEntityDisplay data={rifleAbility} compact expandGrants />)
    expect(screen.getByText('Grants')).toBeTruthy()
    // Body content + choice groups render (all null in the header-only collapse).
    expect(screen.getByText('Weapon Type')).toBeTruthy()
    expect(screen.getByText('Modification')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ballistic/ })).toBeTruthy()
  })

  test('expandGrants: seeded selections on the ability resolve in the nested equipment', () => {
    // ITUN threads the pilot's persisted selections through the granting ability;
    // they must reach the nested granted-equipment choice cards.
    render(
      <ReferenceEntityDisplay
        data={rifleAbility}
        compact
        expandGrants
        selections={{ [weaponTypeChoiceId]: ['Ballistic'] }}
        onSelectionChange={() => {}}
      />
    )
    // Resolved: the Weapon Type prompt is gone and Ballistic shows in the row.
    expect(screen.queryByText('Choose')).toBeNull()
    expect(screen.getAllByText('Ballistic').length).toBeGreaterThan(0)
  })

  test('expandGrants: toggling a nested granted-equipment choice notifies onSelectionChange', () => {
    // The persistence path: a nested choice toggle bubbles up to the granting
    // ability's onSelectionChange (ITUN persists it under pilot.abilityChoices).
    let next: ChoiceSelections | undefined
    render(
      <ReferenceEntityDisplay
        data={rifleAbility}
        compact
        expandGrants
        selections={{}}
        onSelectionChange={(s) => {
          next = s
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    expect(next).toBeDefined()
    expect(next?.[weaponTypeChoiceId]).toEqual(['Ballistic'])
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

describe('controlled choice selections (ITUN persistence path)', () => {
  const weaponTypeId =
    (rifleEquipment
      ? getChoices(rifleEquipment)?.find((c) => c.name === 'Weapon Type')?.id
      : undefined) ?? ''

  test('seeded controlled selections render: Ballistic resolves, the prompt is gone', () => {
    // ITUN seeds persisted selections via the `selections` prop — the resolved row
    // reflects them on first render (no toggle needed).
    render(
      <ReferenceEntityDisplay
        data={rifleEquipment}
        compact
        selections={{ [weaponTypeId]: ['Ballistic'] }}
        onSelectionChange={() => {}}
      />
    )
    expect(screen.getAllByText('Ballistic').length).toBeGreaterThan(0)
    expect(screen.queryByText('Choose')).toBeNull()
  })

  test('toggling notifies the parent via onSelectionChange with the next selections', () => {
    let next: ChoiceSelections | undefined
    render(
      <ReferenceEntityDisplay
        data={rifleEquipment}
        compact
        selections={{}}
        onSelectionChange={(s) => {
          next = s
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    expect(next).toBeDefined()
    expect(next?.[weaponTypeId]).toEqual(['Ballistic'])
  })

  test('controlled with no onSelectionChange is read-only: toggle no-ops, no crash', () => {
    // A published snapshot renders persisted choices read-only — clicking does not
    // mutate (the parent owns `selections` and supplies no change handler).
    render(<ReferenceEntityDisplay data={rifleEquipment} compact selections={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    // Still unresolved — the click changed nothing.
    expect(screen.getByText('Choose')).toBeTruthy()
  })
})
