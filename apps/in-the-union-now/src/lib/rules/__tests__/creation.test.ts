/**
 * Unit tests for the app-side pilot creation step gates + draft clamp
 * (wizard-refresh Phase 3, plan §5.1 app half). The module is a THIN ADAPTER
 * over the package predicates in salvageunion-reference/rules — these tests
 * pin the destructuring + reason copy, not the rule math (that lives beside
 * the package module).
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { clampPilotCreationDraft, pilotCreationStepGate } from '../creation'
import type { PilotWizardFormState } from '../../wizard/pilotFormState'
import { EMPTY_PILOT_FORM_STATE } from '../../wizard/pilotFormState'

beforeAll(async () => {
  await SalvageUnionReference.preload(['classes', 'abilities', 'equipment'])
})

function idOf(name: string, accessor: { find: (fn: (x: { name: string }) => boolean) => unknown }) {
  const found = accessor.find((x) => x.name === name) as { id: string } | undefined
  if (!found) throw new Error(`Reference entity "${name}" not found`)
  return found.id
}

function tech1EquipmentId(): string {
  const item = SalvageUnionReference.Equipment.find(
    (e) => (e as { techLevel?: number }).techLevel === 1
  ) as { id: string } | undefined
  if (!item) throw new Error('no Tech 1 equipment loaded')
  return item.id
}

function higherTechEquipmentId(): string {
  const item = SalvageUnionReference.Equipment.find(
    (e) => (e as { techLevel?: number }).techLevel === 2
  ) as { id: string } | undefined
  if (!item) throw new Error('no Tech 2 equipment loaded')
  return item.id
}

function legalForm(): PilotWizardFormState {
  return {
    ...EMPTY_PILOT_FORM_STATE,
    name: 'Mira Voss',
    callsign: 'Sparks',
    classId: idOf('Engineer', SalvageUnionReference.Classes),
    abilities: [idOf('Engineering Expertise', SalvageUnionReference.Abilities)],
    equipment: [tech1EquipmentId(), tech1EquipmentId()],
  }
}

describe('pilotCreationStepGate', () => {
  it('always passes briefing/flavor steps', () => {
    for (const step of ['stats', 'background', 'motto', 'keepsake', 'appearance'] as const) {
      expect(pilotCreationStepGate(step, EMPTY_PILOT_FORM_STATE).ok).toBe(true)
    }
  })

  it('classAbility: blocks without a class, then without the first ability', () => {
    const noClass = pilotCreationStepGate('classAbility', EMPTY_PILOT_FORM_STATE)
    expect(noClass.ok).toBe(false)
    expect(noClass.reason).toBe('Choose your class to continue')

    const noAbility = pilotCreationStepGate('classAbility', {
      ...legalForm(),
      abilities: [],
    })
    expect(noAbility.ok).toBe(false)
    expect(noAbility.reason).toBe('Choose your first Ability to continue')

    expect(pilotCreationStepGate('classAbility', legalForm()).ok).toBe(true)
  })

  it('classAbility: a specialisation class never passes (hard boundary)', () => {
    const result = pilotCreationStepGate('classAbility', {
      ...legalForm(),
      classId: idOf('Cyborg', SalvageUnionReference.Classes),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('Choose your class to continue')
  })

  it("classAbility: an ability outside the class's core trees never passes", () => {
    const result = pilotCreationStepGate('classAbility', {
      ...legalForm(),
      abilities: [idOf('Charge', SalvageUnionReference.Abilities)], // Soldier tree
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('Choose your first Ability to continue')
  })

  it('equipment: counts down the 2-pick budget in the reason copy', () => {
    const zero = pilotCreationStepGate('equipment', { ...legalForm(), equipment: [] })
    expect(zero.ok).toBe(false)
    expect(zero.reason).toBe('Choose 2 more equipment items to continue')

    const one = pilotCreationStepGate('equipment', {
      ...legalForm(),
      equipment: [tech1EquipmentId()],
    })
    expect(one.ok).toBe(false)
    expect(one.reason).toBe('Choose 1 more equipment item to continue')

    expect(pilotCreationStepGate('equipment', legalForm()).ok).toBe(true)
  })

  it('equipment: duplicates are legal, higher-TL picks are not', () => {
    const dup = tech1EquipmentId()
    expect(pilotCreationStepGate('equipment', { ...legalForm(), equipment: [dup, dup] }).ok).toBe(
      true
    )

    const illegal = pilotCreationStepGate('equipment', {
      ...legalForm(),
      equipment: [dup, higherTechEquipmentId()],
    })
    expect(illegal.ok).toBe(false)
    expect(illegal.reason).toBe('Only Tech 1 equipment is legal at creation')
  })

  it('callsign: both Name and Callsign must be non-empty', () => {
    const missing = pilotCreationStepGate('callsign', { ...legalForm(), callsign: '  ' })
    expect(missing.ok).toBe(false)
    expect(missing.reason).toBe('Enter a Name and Callsign to continue')
    expect(pilotCreationStepGate('callsign', legalForm()).ok).toBe(true)
  })

  it('review: re-checks every gate and names the first unmet one', () => {
    expect(pilotCreationStepGate('review', legalForm()).ok).toBe(true)
    const broken = pilotCreationStepGate('review', { ...legalForm(), equipment: [] })
    expect(broken.ok).toBe(false)
    expect(broken.reason).toBe('Choose 2 more equipment items to continue')
  })
})

describe('clampPilotCreationDraft', () => {
  it('returns a legal draft untouched', () => {
    const form = legalForm()
    const result = clampPilotCreationDraft(form)
    expect(result.form).toBe(form)
    expect(result.removed).toEqual([])
  })

  it('trims excess picks OLDEST-FIRST to the 1/2 budgets', () => {
    const a1 = idOf('Engineering Expertise', SalvageUnionReference.Abilities)
    const a2 = idOf('Jury Rig', SalvageUnionReference.Abilities)
    const a3 = idOf('Mass Field Maintenance', SalvageUnionReference.Abilities)
    const item = tech1EquipmentId()
    const result = clampPilotCreationDraft({
      ...legalForm(),
      abilities: [a1, a2, a3],
      equipment: [item, item, item],
    })
    expect(result.form.abilities).toEqual([a3]) // newest pick survives
    expect(result.form.equipment).toEqual([item, item])
    expect(result.removed).toContain('Engineering Expertise')
    expect(result.removed).toContain('Jury Rig')
    expect(result.removed.length).toBe(3)
  })

  it('drops abilities illegal for the class', () => {
    const soldier = idOf('Soldier', SalvageUnionReference.Classes)
    const result = clampPilotCreationDraft({
      ...legalForm(),
      classId: soldier,
      abilities: [idOf('Engineering Expertise', SalvageUnionReference.Abilities)],
    })
    expect(result.form.abilities).toEqual([])
    expect(result.removed).toEqual(['Engineering Expertise'])
  })

  it('clears an illegal (specialisation) class along with its abilities', () => {
    const result = clampPilotCreationDraft({
      ...legalForm(),
      classId: idOf('Cyborg', SalvageUnionReference.Classes),
    })
    expect(result.form.classId).toBe('')
    expect(result.form.abilities).toEqual([])
    expect(result.removed).toContain('Cyborg')
  })

  it('drops non-Tech-1 equipment', () => {
    const legal = tech1EquipmentId()
    const result = clampPilotCreationDraft({
      ...legalForm(),
      equipment: [higherTechEquipmentId(), legal],
    })
    expect(result.form.equipment).toEqual([legal])
    expect(result.removed.length).toBe(1)
  })
})
