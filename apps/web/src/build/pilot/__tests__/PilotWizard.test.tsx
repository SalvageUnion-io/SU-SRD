/**
 * Integration tests for PilotWizard on the WizShell skeleton, in the Pilot
 * Bay's book order:
 *
 *   Stats → Class & Ability (merged) → Equipment → Callsign → Background →
 *   Motto → Keepsake → Appearance → Review → submit
 *
 * Creation is HARD-enforced (1 ability radio, exactly 2 Tech-1 equipment
 * via Qty steppers, gated Next). Uses the real wizard, real
 * SalvageUnionReference data, real Zod validation, and the real in-memory
 * entityStore (signed in, server commits stubbed).
 *
 * SalvageUnionReference is preloaded via bunfig.toml.
 */

import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../../components/__tests__/must'
import { useUnits } from '../../../replica/units'
import {
  clickButton,
  clickNext,
  getNextButton,
  getPickByName,
  pickByName,
  withWizardStore,
} from '../../__tests__/wizardHarness'
import { PilotWizard } from '../PilotWizard'

withWizardStore('pilot')

function idOf(name: string, accessor: { find: (fn: (x: { name: string }) => boolean) => unknown }) {
  const found = accessor.find((x) => x.name === name) as { id: string } | undefined
  if (!found) throw new Error(`Reference entity "${name}" not found`)
  return found.id
}

function firstTech1Equipment(): { id: string; name: string } {
  const item = SalvageUnionReference.Equipment.find(
    (e) => (e as { techLevel?: number }).techLevel === 1
  ) as { id: string; name: string } | undefined
  if (!item) throw new Error('no Tech 1 equipment loaded')
  return item
}

/** Fill the Callsign step (Name + Callsign) and advance. */
async function fillCallsign(name: string, callsign: string): Promise<void> {
  const nameInput = screen.getByLabelText<HTMLInputElement>(/^Name/)
  const callsignInput = screen.getByLabelText<HTMLInputElement>(/Callsign/)
  await act(async () => {
    fireEvent.change(nameInput, { target: { value: name } })
    fireEvent.change(callsignInput, { target: { value: callsign } })
  })
}

// ---------------------------------------------------------------------------
// Happy path: full pilot creation in book order
// ---------------------------------------------------------------------------

describe('PilotWizard — happy path (book order, hard enforcement)', () => {
  it('walks Stats → Class & Ability → Equipment → Callsign → flavor → Review and creates a legal pilot', async () => {
    const onComplete = mock(() => {})
    const onCancel = mock(() => {})
    render(<PilotWizard onComplete={onComplete} onCancel={onCancel} />)

    // --- Step 1: Your Stats — display-only, Next always enabled ---
    // The fixed pilot stats render as read-only chips (HP | 10/10, …).
    expect(screen.getByText('HP')).toBeTruthy()
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 2: Class & First Ability (merged, both gates hard) ---
    // Next locked until class + exactly 1 legal ability.
    expect(getNextButton().disabled).toBe(true)
    await pickByName('Engineer')
    expect(screen.getByText('Choose your first Ability to continue')).toBeTruthy()
    await pickByName('Engineering Expertise')
    expect(screen.getByTestId('ability-count').textContent).toContain('1/1')
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 3: Equipment — exactly 2 Tech 1 picks (duplicates allowed) ---
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Choose 2 more equipment items to continue/i)).toBeTruthy()
    const item = firstTech1Equipment()
    await pickByName(item.name) // card click adds copy #1
    expect(screen.getByText(/Choose 1 more equipment item to continue/i)).toBeTruthy()
    await clickButton(`Increase ${item.name} count`) // copy #2
    expect(screen.getByTestId('equipment-count').textContent).toContain('2/2')
    expect(getNextButton().disabled).toBe(false)
    // At the budget every '+' disables.
    const plusButtons = screen.getAllByRole<HTMLButtonElement>('button', {
      name: /^Increase .* count$/,
    })
    for (const plus of plusButtons) {
      expect(plus.disabled).toBe(true)
    }
    await clickNext()

    // --- Step 4: Callsign (Name + Callsign required) ---
    expect(getNextButton().disabled).toBe(true)
    await fillCallsign('Mira Voss', 'Sparks')
    await clickNext()

    // --- Steps 5–8: Background, Motto, Keepsake, Appearance — optional ---
    await clickNext() // Background
    await clickNext() // Motto
    await clickNext() // Keepsake
    await clickNext() // Appearance

    // --- Review → submit ('Create Pilot ✦'), recap present, no soft banner ---
    expect(screen.getByText(/1 class · 1 ability · 2 Tech 1 items/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    await clickButton(/Create Pilot/i)

    await waitFor(() => {
      const pilots = useUnits.getState().list('pilot')
      expect(pilots.length).toBe(1)
      const p = must(pilots[0])
      expect(p.name).toBe('Mira Voss')
      expect(p.callsign).toBe('Sparks')
      expect(p.classRef).toBeTruthy()
      expect(p.abilities.length).toBe(1)
      expect(p.equipment.length).toBe(2)
      expect(p.equipment[0]).toBe(p.equipment[1] as string) // duplicates are legal
      expect(p.conditions).toEqual([])
      expect(p.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Hard enforcement mechanics
// ---------------------------------------------------------------------------

describe('PilotWizard — hard creation enforcement', () => {
  it('ability pick is a RADIO: a new pick replaces the old, never a second slot', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability
    await pickByName('Engineer')
    await pickByName('Engineering Expertise')
    expect(screen.getByTestId('ability-count').textContent).toContain('1/1')
    await pickByName('Jury Rig')
    // Still exactly one pick — replaced, not added.
    expect(screen.getByTestId('ability-count').textContent).toContain('1/1')
    expect(getPickByName('Jury Rig').getAttribute('aria-checked')).toBe('true')
    expect(getPickByName('Engineering Expertise').getAttribute('aria-checked')).toBe('false')
  })

  it('changing class clears a now-illegal ability (cross-step invalidation)', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pickByName('Engineer')
    await pickByName('Engineering Expertise') // Mechanical Knowledge L1
    await pickByName('Soldier') // Mechanical Knowledge ∉ Soldier trees
    expect(screen.getByTestId('ability-count').textContent).toContain('0/1')
    expect(getNextButton().disabled).toBe(true)
  })

  it('keeps a still-legal ability across a class change (Salvager shares core trees)', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pickByName('Engineer')
    await pickByName('Engineering Expertise') // Mechanical Knowledge L1 — also a Salvager tree
    await pickByName('Salvager')
    expect(screen.getByTestId('ability-count').textContent).toContain('1/1')
  })

  it('offers the Salvager all 15 core-tree Level-1 abilities and no specialisation classes', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    // Non-core classes are filtered OUT of guided create entirely.
    expect(screen.queryByRole('radio', { name: 'Cyborg' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Fabricator' })).toBeNull()
    await pickByName('Salvager')
    const level1 = SalvageUnionReference.Abilities.findAll(
      (a) => (a as { level: number | string }).level === 1
    )
    expect(level1.length).toBe(25) // 15 core + 10 advanced-tree level-1s in the catalog
    const salvager = SalvageUnionReference.Classes.getByName('Salvager') as {
      coreTrees: string[]
    }
    const legal = level1.filter((a) =>
      salvager.coreTrees.includes((a as { tree: string }).tree)
    ) as { name: string }[]
    expect(legal.length).toBe(15)
    for (const ability of legal) {
      expect(screen.getByRole('radio', { name: ability.name })).toBeTruthy()
    }
    // Advanced-tree Level-1s never render in guided create.
    const advanced = level1.filter(
      (a) => !salvager.coreTrees.includes((a as { tree: string }).tree)
    ) as { name: string }[]
    for (const ability of advanced) {
      expect(screen.queryByRole('radio', { name: ability.name })).toBeNull()
    }
  })

  it('equipment Qty stepper supports duplicates and the − removes a copy', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pickByName('Engineer')
    await pickByName('Engineering Expertise')
    await clickNext()

    const item = firstTech1Equipment()
    const plus = () =>
      screen.getByRole<HTMLButtonElement>('button', { name: `Increase ${item.name} count` })

    await clickButton(`Increase ${item.name} count`)
    await clickButton(`Increase ${item.name} count`)
    expect(screen.getByTestId('equipment-count').textContent).toContain('2/2')
    expect(plus().disabled).toBe(true)
    await clickButton(`Decrease ${item.name} count`)
    expect(screen.getByTestId('equipment-count').textContent).toContain('1/2')
    expect(plus().disabled).toBe(false)
  })

  it('slot preview uses pilotInventory math, not pick count', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pickByName('Engineer')
    await pickByName('Engineering Expertise')
    await clickNext()
    // 0 picks → 0 / 6 slots (base capacity).
    expect(screen.getByTestId('slot-preview').textContent).toContain('/6')
  })
})

// ---------------------------------------------------------------------------
// Draft clamping (§5.3): a pre-enforcement 3/3 draft heals deterministically
// ---------------------------------------------------------------------------

describe('PilotWizard — draft restore clamps to the 1/2 budgets', () => {
  it('trims excess ability and equipment picks oldest-first on mount', async () => {
    const classId = idOf('Engineer', SalvageUnionReference.Classes)
    const a1 = nameToSlug('Engineering Expertise')
    const a2 = nameToSlug('Jury Rig')
    const a3 = nameToSlug('Mass Field Maintenance')
    const item = firstTech1Equipment()
    sessionStorage.setItem(
      'app-wizard-draft:pilot:new',
      JSON.stringify({
        name: 'Legacy',
        classId,
        abilities: [a1, a2, a3],
        equipment: [nameToSlug(item.name), nameToSlug(item.name), nameToSlug(item.name)],
        callsign: 'Old',
        motto: '',
        keepsake: '',
        appearance: '',
        background: '',
        description: '',
      })
    )

    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability

    // Oldest-first removal keeps the NEWEST ability pick (a3).
    expect(screen.getByTestId('ability-count').textContent).toContain('1/1')
    expect(getPickByName('Mass Field Maintenance').getAttribute('aria-checked')).toBe('true')
    await clickNext() // → Equipment
    expect(screen.getByTestId('equipment-count').textContent).toContain('2/2')
  })
})

// ---------------------------------------------------------------------------
// Draft persistence: unmount → remount restores the session
// draft; a confirmed Cancel discards it.
// ---------------------------------------------------------------------------

describe('PilotWizard — session drafts', () => {
  it('restores in-progress state after unmount and clears it on confirmed cancel', async () => {
    const { unmount } = render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability
    await pickByName('Engineer')

    // Simulate a refresh/navigation: unmount, then mount a fresh wizard.
    await act(async () => {
      unmount()
    })
    expect(sessionStorage.getItem('app-wizard-draft:pilot:new')).not.toBeNull()

    const onCancel = mock(() => {})
    render(<PilotWizard onComplete={() => {}} onCancel={onCancel} />)
    // The class pick survived: after advancing to Class & Ability, Engineer's
    // SelCard ring is the active selection.
    await clickNext()
    expect(getPickByName('Engineer').getAttribute('aria-checked')).toBe('true')

    // Cancel on a dirty form asks first; confirming discards the draft.
    await clickButton('Cancel')
    await clickButton('Discard')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('app-wizard-draft:pilot:new')).toBeNull()
  })
})

describe('PilotWizard — preselected class', () => {
  it('starts on the deep-linked class (`?class=engineer`, resolved to its id)', async () => {
    render(
      <PilotWizard
        onComplete={() => {}}
        onCancel={() => {}}
        preselectClassId={idOf('Engineer', SalvageUnionReference.Classes)}
      />
    )
    await clickNext() // Stats → Class & Ability
    expect(getPickByName('Engineer').getAttribute('aria-checked')).toBe('true')
    // The ability is still the player's pick.
    expect(screen.getByText('Choose your first Ability to continue')).toBeTruthy()
  }, 30000)
})
