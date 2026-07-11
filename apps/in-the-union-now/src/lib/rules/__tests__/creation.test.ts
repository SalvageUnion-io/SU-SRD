/**
 * Unit tests for the app-side pilot creation step gates + draft clamp
 * (wizard-refresh Phase 3, plan §5.1 app half). The module is a THIN ADAPTER
 * over the package predicates in salvageunion-reference/rules — these tests
 * pin the destructuring + reason copy, not the rule math (that lives beside
 * the package module).
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  clampMechCreationDraft,
  clampPilotCreationDraft,
  mechCreationBudgetFor,
  mechCreationStepGate,
  pilotCreationStepGate,
} from '../creation'
import type { PilotWizardFormState } from '../../wizard/pilotFormState'
import { EMPTY_PILOT_FORM_STATE } from '../../wizard/pilotFormState'
import type { MechWizardFormState } from '../../wizard/mechFormState'
import { EMPTY_MECH_FORM_STATE } from '../../wizard/mechFormState'

beforeAll(async () => {
  await SalvageUnionReference.preload([
    'classes',
    'abilities',
    'equipment',
    'chassis',
    'systems',
    'modules',
  ])
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

// ---------------------------------------------------------------------------
// Mech Workshop (Phase 4)
// ---------------------------------------------------------------------------

function slugOf(
  name: string,
  accessor: { find: (fn: (x: { name?: string }) => boolean) => unknown }
): string {
  const found = accessor.find((x) => x.name === name) as { id: string } | undefined
  if (!found) throw new Error(`Reference entity "${name}" not found`)
  return found.id
}

function higherTlChassisId(): string {
  const found = SalvageUnionReference.Chassis.find((c) => c.techLevel === 2)
  if (!found) throw new Error('no Tech 2 chassis loaded')
  return found.id
}

/** Mule (SV 7) + Cargo Pod (SV 1) + Comms Module (SV 1): spent 9 / cap 20. */
function legalMechForm(): MechWizardFormState {
  return {
    ...EMPTY_MECH_FORM_STATE,
    name: 'Iron Fist',
    patternName: 'Iron Fist',
    chassisName: slugOf('Mule', SalvageUnionReference.Chassis),
    systems: [slugOf('Cargo Pod', SalvageUnionReference.Systems)],
    modules: [slugOf('Comms Module', SalvageUnionReference.Modules)],
  }
}

describe('mechCreationBudgetFor', () => {
  it('debits the chassis SV + every installed copy from the 20 cap', () => {
    const budget = mechCreationBudgetFor(legalMechForm())
    expect(budget.cap).toBe(20)
    expect(budget.spent).toBe(9) // Mule 7 + Cargo Pod 1 + Comms Module 1
    expect(budget.remaining).toBe(11)
  })

  it('an empty form leaves the full 20', () => {
    expect(mechCreationBudgetFor(EMPTY_MECH_FORM_STATE).remaining).toBe(20)
  })
})

describe('mechCreationStepGate', () => {
  it('always passes briefing, crafting (optional), and flavor steps', () => {
    for (const step of ['scrap', 'stats', 'systems', 'modules', 'quirk', 'appearance'] as const) {
      expect(mechCreationStepGate(step, EMPTY_MECH_FORM_STATE).ok).toBe(true)
    }
  })

  it('chassis: blocks while unchosen and for a non-Tech-1 chassis (hard boundary)', () => {
    const missing = mechCreationStepGate('chassis', EMPTY_MECH_FORM_STATE)
    expect(missing.ok).toBe(false)
    expect(missing.reason).toBe('Craft your Chassis to continue')

    const illegal = mechCreationStepGate('chassis', {
      ...legalMechForm(),
      chassisName: higherTlChassisId(),
    })
    expect(illegal.ok).toBe(false)
    expect(illegal.reason).toBe('Craft your Chassis to continue')

    expect(mechCreationStepGate('chassis', legalMechForm()).ok).toBe(true)
  })

  it('pattern: the name is required (a mech’s name IS its pattern)', () => {
    const blocked = mechCreationStepGate('pattern', { ...legalMechForm(), name: '  ' })
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('Name your Pattern to continue')
    expect(mechCreationStepGate('pattern', legalMechForm()).ok).toBe(true)
  })

  it('review: re-checks chassis, name, TL legality, and both budgets', () => {
    expect(mechCreationStepGate('review', legalMechForm()).ok).toBe(true)

    const higherTlSystem = SalvageUnionReference.Systems.find((s) => s.techLevel === 2)
    if (!higherTlSystem) throw new Error('no Tech 2 system loaded')
    const illegalTl = mechCreationStepGate('review', {
      ...legalMechForm(),
      systems: [higherTlSystem.id],
    })
    expect(illegalTl.ok).toBe(false)
    expect(illegalTl.reason).toBe('Only Tech 1 Systems and Modules are legal at creation')

    // Overspend the shared pool with 14 Cargo Pods (7 + 14 > 20) — slot-legal
    // (14 of the Mule's 16 system slots), so exactly the scrap gate trips.
    const pod = slugOf('Cargo Pod', SalvageUnionReference.Systems)
    const overspent = mechCreationStepGate('review', {
      ...legalMechForm(),
      systems: new Array<string>(14).fill(pod),
      modules: [],
    })
    expect(overspent.ok).toBe(false)
    expect(overspent.reason).toBe('Over the 20 Tech 1 Scrap budget — remove items')
  })
})

describe('clampMechCreationDraft (knapsack, not truncation)', () => {
  it('returns a legal draft untouched', () => {
    const form = legalMechForm()
    const result = clampMechCreationDraft(form)
    expect(result.form).toBe(form)
    expect(result.removed).toEqual([])
  })

  it('preserves chassis + pattern and drops NEWEST copies until every budget fits', () => {
    const pod = slugOf('Cargo Pod', SalvageUnionReference.Systems) // SV 1 · 1 slot
    const comms = slugOf('Comms Module', SalvageUnionReference.Modules) // SV 1 · 1 slot
    // Mule: SV 7, 16 system slots, 2 module slots. 14 pods + 3 comms spends
    // 24/20 and overflows the module slots. The walk drops NEWEST first —
    // modules (the later step) down to zero, then one pod — landing exactly
    // on the cap: 13 pods, 0 comms, 4 removals.
    const result = clampMechCreationDraft({
      ...legalMechForm(),
      systems: new Array<string>(14).fill(pod),
      modules: new Array<string>(3).fill(comms),
    })
    expect(result.form.chassisName).toBe(slugOf('Mule', SalvageUnionReference.Chassis))
    expect(result.form.patternName).toBe('Iron Fist')
    expect(result.form.systems.length).toBe(13)
    expect(result.form.modules.length).toBe(0)
    expect(result.removed.length).toBe(4)
    expect(mechCreationBudgetFor(result.form).remaining).toBe(0)
    // The healed draft satisfies the Review gate — the invariant holds.
    expect(mechCreationStepGate('review', result.form).ok).toBe(true)
  })

  it('drops non-Tech-1 installs and itemizes them by name', () => {
    const higherTlSystem = SalvageUnionReference.Systems.find((s) => s.techLevel === 2)
    if (!higherTlSystem) throw new Error('no Tech 2 system loaded')
    const pod = slugOf('Cargo Pod', SalvageUnionReference.Systems)
    const result = clampMechCreationDraft({
      ...legalMechForm(),
      systems: [pod, higherTlSystem.id],
    })
    expect(result.form.systems).toEqual([pod])
    expect(result.removed).toContain(higherTlSystem.name)
  })

  it('clears an illegal chassis along with the whole loadout', () => {
    const result = clampMechCreationDraft({
      ...legalMechForm(),
      chassisName: higherTlChassisId(),
    })
    expect(result.form.chassisName).toBe('')
    expect(result.form.systems).toEqual([])
    expect(result.form.modules).toEqual([])
    expect(result.removed.length).toBeGreaterThanOrEqual(3) // chassis + 2 installs
  })

  it('clears pre-Phase-4 starting cargo (guided create grants none)', () => {
    const result = clampMechCreationDraft({
      ...legalMechForm(),
      cargoLots: [
        {
          id: 'lot-1',
          kind: 'bulk',
          name: 'Scrap',
          cat: 'SCRAP',
          tl: 1,
          qty: 3,
          units: 3,
          code: 'SCR',
        },
      ],
    })
    expect(result.form.cargoLots).toEqual([])
    expect(result.removed).toContain('starting cargo')
  })
})
