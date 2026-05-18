import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectGuideStep, SURefGuide } from 'salvageunion-reference'
import {
  getDigitalSteps,
  resolveStepEntities,
  resolveConstraintMax,
  rollOnTable,
  validateStep,
  canSubmitWizard,
  createInitialWizardState,
  createWizardReducer,
  wizardToCreateInput,
  mechWizardToInstantiateInput,
} from './pilotUtils'
import type { WizardState } from './pilotUtils'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const pilotGuide = SalvageUnionReference.Guides.find(
  (g) => g.name === 'Create a Pilot'
)! as SURefGuide

const allSteps = pilotGuide.steps
const digitalSteps = getDigitalSteps(pilotGuide)

// Find specific steps by their characteristics
const classStep = digitalSteps.find(
  (s) => s.stepType === 'select-one' && s.schema?.[0] === 'classes'
)!
const abilityStep = digitalSteps.find(
  (s) => s.stepType === 'select-one' && s.schema?.[0] === 'abilities'
)!
const equipmentStep = digitalSteps.find(
  (s) => s.stepType === 'select-many' && s.schema?.[0] === 'equipment'
)!
const callsignStep = digitalSteps.find(
  (s) => s.stepType === 'roll-table' && s.rollTable === 'Callsign Table'
)!

// Get a real class (Engineer) for testing
const engineerClass = SalvageUnionReference.Classes.find((c) => c.name === 'Engineer')!

// Mech guide test data
const mechGuide = SalvageUnionReference.Guides.find(
  (g) => g.name === 'Create a Mech'
)! as SURefGuide

const mechDigitalSteps = getDigitalSteps(mechGuide)

const chassisStep = mechDigitalSteps.find(
  (s) => s.stepType === 'select-one' && s.schema?.[0] === 'chassis'
)!
const systemsStep = mechDigitalSteps.find(
  (s) => s.stepType === 'select-many' && s.schema?.[0] === 'systems'
)!
const modulesStep = mechDigitalSteps.find(
  (s) => s.stepType === 'select-many' && s.schema?.[0] === 'modules'
)!
const mechNameStep = mechDigitalSteps.find((s) => s.rollTable === 'Mech Pattern Names')!

// Get a real chassis for testing
const muleChassis = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')! as {
  id: string
  name: string
  systemSlots: number
  moduleSlots: number
}
// Get a real system and module for testing
const firstSystem = SalvageUnionReference.Systems.find(() => true)!
const firstModule = SalvageUnionReference.Modules.find(() => true)!

// ---------------------------------------------------------------------------
// getDigitalSteps
// ---------------------------------------------------------------------------

describe('getDigitalSteps', () => {
  test('filters out paperOnly steps', () => {
    const paperOnlySteps = allSteps.filter((s) => s.paperOnly)
    expect(paperOnlySteps.length).toBeGreaterThan(0)
    expect(digitalSteps.length).toBe(allSteps.length - paperOnlySteps.length)
  })

  test('no digital step has paperOnly=true', () => {
    expect(digitalSteps.every((s) => !s.paperOnly)).toBe(true)
  })

  test('preserves step order', () => {
    const filteredManual = allSteps.filter((s) => !s.paperOnly)
    expect(digitalSteps.map((s) => s.id)).toEqual(filteredManual.map((s) => s.id))
  })
})

// ---------------------------------------------------------------------------
// resolveStepEntities
// ---------------------------------------------------------------------------

describe('resolveStepEntities', () => {
  test('resolves classes for class step', () => {
    const state = createInitialWizardState()
    const entities = resolveStepEntities(classStep, state)
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0]!.schemaName).toBe('classes')
  })

  test('resolves only 6 base classes (no hybrids)', () => {
    const state = createInitialWizardState()
    const entities = resolveStepEntities(classStep, state)
    // The guide filter has { field: "hybrid", value: false }
    // and schemaEntities lists 6 classes
    expect(entities.length).toBe(6)
  })

  test('resolves abilities with disabled flag for non-matching coreTrees', () => {
    // Select Engineer
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
      },
      currentStepIndex: 1,
    }
    const entities = resolveStepEntities(abilityStep, state)
    expect(entities.length).toBeGreaterThan(0)

    const coreTrees = (engineerClass as { coreTrees: string[] }).coreTrees

    // Enabled abilities should belong to Engineer's coreTrees
    const enabled = entities.filter((e) => !e.disabled)
    expect(enabled.length).toBeGreaterThan(0)
    for (const { data } of enabled) {
      const ability = data as { tree?: string }
      if (ability.tree) {
        expect(coreTrees).toContain(ability.tree)
      }
    }

    // Disabled abilities should NOT belong to Engineer's coreTrees
    const disabled = entities.filter((e) => e.disabled)
    expect(disabled.length).toBeGreaterThan(0)
    for (const { data } of disabled) {
      const ability = data as { tree?: string }
      if (ability.tree) {
        expect(coreTrees).not.toContain(ability.tree)
      }
    }
  })

  test('resolves equipment for equipment step', () => {
    const state = createInitialWizardState()
    const entities = resolveStepEntities(equipmentStep, state)
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0]!.schemaName).toBe('equipment')
  })

  test('returns empty for steps without schema', () => {
    const infoStep: SURefObjectGuideStep = {
      id: 'test-info',
      name: 'Test',
      stepType: 'info',
    }
    const entities = resolveStepEntities(infoStep, createInitialWizardState())
    expect(entities).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// rollOnTable
// ---------------------------------------------------------------------------

describe('rollOnTable', () => {
  test('returns a non-empty result for Callsign Table', () => {
    const { text, roll } = rollOnTable('Callsign Table')
    expect(text.length).toBeGreaterThan(0)
    expect(roll).toBeGreaterThanOrEqual(1)
  })

  test('returns a result for Background table', () => {
    const { text } = rollOnTable('Background')
    expect(text.length).toBeGreaterThan(0)
  })

  test('returns a result for Motto table', () => {
    const { text } = rollOnTable('Motto')
    expect(text.length).toBeGreaterThan(0)
  })

  test('returns empty for unknown table', () => {
    const { text, roll } = rollOnTable('Nonexistent Table')
    expect(text).toBe('')
    expect(roll).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// validateStep
// ---------------------------------------------------------------------------

describe('validateStep', () => {
  test('info steps are always complete', () => {
    const infoStep: SURefObjectGuideStep = {
      id: 'test-info',
      name: 'Test',
      stepType: 'info',
    }
    const result = validateStep(infoStep, createInitialWizardState())
    expect(result.isComplete).toBe(true)
    expect(result.canProceed).toBe(true)
  })

  test('select-one requires exactly one selection', () => {
    const state = createInitialWizardState()
    const result = validateStep(classStep, state)
    expect(result.isComplete).toBe(false)

    const stateWithSelection: WizardState = {
      ...state,
      selections: { [classStep.id]: { selectedIds: ['some-id'], schemaName: 'classes' } },
    }
    const result2 = validateStep(classStep, stateWithSelection)
    expect(result2.isComplete).toBe(true)
    expect(result2.canProceed).toBe(true)
  })

  test('select-many enforces min/max constraints', () => {
    const state = createInitialWizardState()
    const result = validateStep(equipmentStep, state)
    expect(result.isComplete).toBe(false)

    // One item (below max 2 but meets min 1)
    const stateWith1: WizardState = {
      ...state,
      selections: { [equipmentStep.id]: { selectedIds: ['eq-1'], schemaName: 'equipment' } },
    }
    expect(validateStep(equipmentStep, stateWith1).canProceed).toBe(true)

    // Two items (meets max)
    const stateWith2: WizardState = {
      ...state,
      selections: {
        [equipmentStep.id]: { selectedIds: ['eq-1', 'eq-2'], schemaName: 'equipment' },
      },
    }
    expect(validateStep(equipmentStep, stateWith2).isComplete).toBe(true)
  })

  test('select-many over max is invalid', () => {
    const stateOver: WizardState = {
      selections: {
        [equipmentStep.id]: {
          selectedIds: ['eq-1', 'eq-2', 'eq-3'],
          schemaName: 'equipment',
        },
      },
      currentStepIndex: 0,
    }
    const result = validateStep(equipmentStep, stateOver)
    expect(result.isComplete).toBe(false)
    expect(result.canProceed).toBe(false)
  })

  test('roll-table requires text value', () => {
    const state = createInitialWizardState()
    expect(validateStep(callsignStep, state).isComplete).toBe(false)

    const withText: WizardState = {
      ...state,
      selections: { [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' } },
    }
    expect(validateStep(callsignStep, withText).isComplete).toBe(true)
  })

  test('roll-table with whitespace-only text is not complete', () => {
    const state: WizardState = {
      selections: { [callsignStep.id]: { selectedIds: [], textValue: '   ' } },
      currentStepIndex: 0,
    }
    expect(validateStep(callsignStep, state).isComplete).toBe(false)
    expect(validateStep(callsignStep, state).canProceed).toBe(false)
  })

  test('optional step with no selection: canProceed true, isComplete false', () => {
    const optionalStep: SURefObjectGuideStep = {
      id: 'test-optional',
      name: 'Optional',
      stepType: 'roll-table',
      optional: true,
    }
    const result = validateStep(optionalStep, createInitialWizardState())
    expect(result.canProceed).toBe(true)
    expect(result.isComplete).toBe(false)
  })

  test('optional select-one with a selection is complete and can proceed', () => {
    const optionalSelectOne: SURefObjectGuideStep = {
      id: 'test-opt-select',
      name: 'Optional Select',
      stepType: 'select-one',
      optional: true,
      schema: ['chassis'],
    }
    const state: WizardState = {
      selections: { 'test-opt-select': { selectedIds: ['some-id'], schemaName: 'chassis' } },
      currentStepIndex: 0,
    }
    const result = validateStep(optionalSelectOne, state)
    expect(result.isComplete).toBe(true)
    expect(result.canProceed).toBe(true)
  })

  test('optional select-many with valid selections is complete', () => {
    const optionalMany: SURefObjectGuideStep = {
      id: 'test-opt-many',
      name: 'Optional Many',
      stepType: 'select-many',
      optional: true,
      schema: ['systems'],
      constraints: { max: 3 },
    }
    const state: WizardState = {
      selections: { 'test-opt-many': { selectedIds: ['a', 'b'], schemaName: 'systems' } },
      currentStepIndex: 0,
    }
    const result = validateStep(optionalMany, state)
    expect(result.isComplete).toBe(true)
    expect(result.canProceed).toBe(true)
  })

  test('optional select-many over max is incomplete but can still proceed', () => {
    const optionalMany: SURefObjectGuideStep = {
      id: 'test-opt-many',
      name: 'Optional Many',
      stepType: 'select-many',
      optional: true,
      schema: ['systems'],
      constraints: { max: 2 },
    }
    const state: WizardState = {
      selections: { 'test-opt-many': { selectedIds: ['a', 'b', 'c'], schemaName: 'systems' } },
      currentStepIndex: 0,
    }
    const result = validateStep(optionalMany, state)
    expect(result.isComplete).toBe(false)
    expect(result.canProceed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Wizard Reducer
// ---------------------------------------------------------------------------

describe('wizardReducer', () => {
  const reducer = createWizardReducer(digitalSteps)

  test('SELECT_ENTITY adds entity to step', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: classStep.id,
      entityId: engineerClass.id,
      schemaName: 'classes',
    })
    expect(next.selections[classStep.id]!.selectedIds).toEqual([engineerClass.id])
  })

  test('SELECT_ENTITY on select-one replaces previous selection', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: ['old-id'], schemaName: 'classes' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: classStep.id,
      entityId: engineerClass.id,
      schemaName: 'classes',
    })
    expect(next.selections[classStep.id]!.selectedIds).toEqual([engineerClass.id])
  })

  test('SELECT_ENTITY on select-one resets dependent steps', () => {
    // Pre-populate ability selection
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: ['old-class-id'], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['old-ability-id'], schemaName: 'abilities' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: classStep.id,
      entityId: engineerClass.id,
      schemaName: 'classes',
    })
    // Ability step should be reset because it has contextFrom pointing to class step
    expect(next.selections[abilityStep.id]).toBeUndefined()
  })

  test('SELECT_ENTITY on select-many toggles selection', () => {
    const state = createInitialWizardState()
    // Add first
    const state1 = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-1',
      schemaName: 'equipment',
    })
    expect(state1.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-1'])

    // Add second
    const state2 = reducer(state1, {
      type: 'SELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-2',
      schemaName: 'equipment',
    })
    expect(state2.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-1', 'eq-2'])

    // Toggle off first (clicking same entity removes it)
    const state3 = reducer(state2, {
      type: 'SELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-1',
      schemaName: 'equipment',
    })
    expect(state3.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-2'])
  })

  test('SELECT_ENTITY on select-many enforces max constraint', () => {
    const state: WizardState = {
      selections: {
        [equipmentStep.id]: { selectedIds: ['eq-1', 'eq-2'], schemaName: 'equipment' },
      },
      currentStepIndex: 0,
    }
    // Try to add a third (max is 2)
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-3',
      schemaName: 'equipment',
    })
    expect(next.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-1', 'eq-2'])
  })

  test('SET_TEXT sets text value', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SET_TEXT',
      stepId: callsignStep.id,
      value: 'Rust Devil',
    })
    expect(next.selections[callsignStep.id]!.textValue).toBe('Rust Devil')
  })

  test('SET_ROLL sets roll and text values', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SET_ROLL',
      stepId: callsignStep.id,
      rollValue: 15,
      textValue: 'Ironjaw',
    })
    expect(next.selections[callsignStep.id]!.rollValue).toBe(15)
    expect(next.selections[callsignStep.id]!.textValue).toBe('Ironjaw')
  })

  test('SELECT_ENTITY auto-advances on select-one completion', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: classStep.id,
      entityId: engineerClass.id,
      schemaName: 'classes',
    })
    // select-one is complete after one selection, so should auto-advance
    expect(next.currentStepIndex).toBe(1)
  })

  test('SET_ROLL auto-advances', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SET_ROLL',
      stepId: callsignStep.id,
      rollValue: 15,
      textValue: 'Ironjaw',
    })
    expect(next.currentStepIndex).toBe(1)
  })

  test('GO_TO_STEP sets specific index', () => {
    const state = createInitialWizardState()
    const next = reducer(state, { type: 'GO_TO_STEP', stepIndex: 3 })
    expect(next.currentStepIndex).toBe(3)
  })

  test('RESET returns initial state', () => {
    const state: WizardState = {
      selections: { [classStep.id]: { selectedIds: ['test'], schemaName: 'classes' } },
      currentStepIndex: 5,
    }
    const next = reducer(state, { type: 'RESET' })
    expect(next.selections).toEqual({})
    expect(next.currentStepIndex).toBe(0)
  })

  test('DESELECT_ENTITY removes entity from selection', () => {
    const state: WizardState = {
      selections: {
        [equipmentStep.id]: { selectedIds: ['eq-1', 'eq-2'], schemaName: 'equipment' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'DESELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-1',
    })
    expect(next.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-2'])
  })

  test('DESELECT_ENTITY on non-existent step returns unchanged state', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'DESELECT_ENTITY',
      stepId: 'non-existent',
      entityId: 'eq-1',
    })
    expect(next).toBe(state)
  })

  test('DESELECT_ENTITY for non-existent entity preserves others', () => {
    const state: WizardState = {
      selections: {
        [equipmentStep.id]: { selectedIds: ['eq-1', 'eq-2'], schemaName: 'equipment' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'DESELECT_ENTITY',
      stepId: equipmentStep.id,
      entityId: 'eq-999',
    })
    expect(next.selections[equipmentStep.id]!.selectedIds).toEqual(['eq-1', 'eq-2'])
  })

  test('SELECT_ENTITY on select-one toggles off when re-clicking same entity', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'SELECT_ENTITY',
      stepId: classStep.id,
      entityId: engineerClass.id,
      schemaName: 'classes',
    })
    expect(next.selections[classStep.id]!.selectedIds).toEqual([])
  })

  test('auto-advance clamps to last step index', () => {
    const lastIndex = digitalSteps.length - 1
    const state: WizardState = {
      selections: {},
      currentStepIndex: lastIndex,
    }
    // Select on the last step — should not go beyond bounds
    const lastStep = digitalSteps[lastIndex]!
    const next = reducer(state, {
      type: 'SET_ROLL',
      stepId: lastStep.id,
      rollValue: 5,
      textValue: 'test',
    })
    expect(next.currentStepIndex).toBe(lastIndex)
  })

  test('SET_TEXT preserves existing selectedIds', () => {
    const state: WizardState = {
      selections: {
        [callsignStep.id]: { selectedIds: ['pre-existing'], textValue: 'old' },
      },
      currentStepIndex: 0,
    }
    const next = reducer(state, {
      type: 'SET_TEXT',
      stepId: callsignStep.id,
      value: 'new value',
    })
    expect(next.selections[callsignStep.id]!.textValue).toBe('new value')
    expect(next.selections[callsignStep.id]!.selectedIds).toEqual(['pre-existing'])
  })

  test('SET_TEXT on step without existing selection initializes selectedIds', () => {
    const state = createInitialWizardState()
    const next = reducer(state, {
      type: 'SET_TEXT',
      stepId: callsignStep.id,
      value: 'Rust Devil',
    })
    expect(next.selections[callsignStep.id]!.selectedIds).toEqual([])
    expect(next.selections[callsignStep.id]!.textValue).toBe('Rust Devil')
  })

  test('GO_TO_STEP clamps negative index to 0', () => {
    const state = createInitialWizardState()
    const next = reducer(state, { type: 'GO_TO_STEP', stepIndex: -5 })
    expect(next.currentStepIndex).toBe(0)
  })

  test('GO_TO_STEP clamps past-end index to last step', () => {
    const state = createInitialWizardState()
    const next = reducer(state, { type: 'GO_TO_STEP', stepIndex: 9999 })
    expect(next.currentStepIndex).toBe(digitalSteps.length - 1)
  })
})

// ---------------------------------------------------------------------------
// canSubmitWizard
// ---------------------------------------------------------------------------

describe('canSubmitWizard', () => {
  test('returns false with empty state for pilot wizard', () => {
    expect(canSubmitWizard(createInitialWizardState(), digitalSteps)).toBe(false)
  })

  test('returns true when all required pilot steps are complete', () => {
    // Find all required steps and fill them in
    const backgroundStep = digitalSteps.find(
      (s) => s.stepType === 'roll-table' && s.rollTable === 'Background'
    )!
    const mottoStep = digitalSteps.find(
      (s) => s.stepType === 'roll-table' && s.rollTable === 'Motto'
    )!
    const keepsakeStep = digitalSteps.find(
      (s) => s.stepType === 'roll-table' && s.rollTable === 'Keepsake'
    )!

    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [equipmentStep.id]: { selectedIds: ['eq-1'], schemaName: 'equipment' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
        [backgroundStep.id]: { selectedIds: [], textValue: 'Scavenger' },
        [mottoStep.id]: { selectedIds: [], textValue: 'Never give up' },
        [keepsakeStep.id]: { selectedIds: [], textValue: 'A locket' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, digitalSteps)).toBe(true)
  })

  test('returns false when one required pilot step is missing', () => {
    // Missing callsign (required)
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [equipmentStep.id]: { selectedIds: ['eq-1'], schemaName: 'equipment' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, digitalSteps)).toBe(false)
  })

  test('returns false with empty state for mech wizard', () => {
    expect(canSubmitWizard(createInitialWizardState(), mechDigitalSteps)).toBe(false)
  })

  test('mech wizard: chassis + name is submittable (systems/modules are optional)', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [mechNameStep.id]: { selectedIds: [], textValue: 'Iron Mongrel' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, mechDigitalSteps)).toBe(true)
  })

  test('mech wizard: chassis + systems + name is submittable', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: { selectedIds: [firstSystem.id], schemaName: 'systems' },
        [mechNameStep.id]: { selectedIds: [], textValue: 'Iron Mongrel' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, mechDigitalSteps)).toBe(true)
  })

  test('mech wizard: no chassis is not submittable', () => {
    const state: WizardState = {
      selections: {
        [systemsStep.id]: { selectedIds: [firstSystem.id], schemaName: 'systems' },
        [mechNameStep.id]: { selectedIds: [], textValue: 'Iron Mongrel' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, mechDigitalSteps)).toBe(false)
  })

  test('mech wizard: missing pattern name is not submittable', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
      },
      currentStepIndex: 0,
    }
    expect(canSubmitWizard(state, mechDigitalSteps)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// wizardToCreateInput
// ---------------------------------------------------------------------------

describe('wizardToCreateInput', () => {
  test('returns null when class is missing', () => {
    const state: WizardState = {
      selections: {
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
      },
      currentStepIndex: 0,
    }
    expect(wizardToCreateInput(state, digitalSteps)).toBeNull()
  })

  test('returns null when callsign is missing', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
      },
      currentStepIndex: 0,
    }
    expect(wizardToCreateInput(state, digitalSteps)).toBeNull()
  })

  test('returns valid input when all required fields present', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [equipmentStep.id]: { selectedIds: ['eq-1', 'eq-2'], schemaName: 'equipment' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
      },
      currentStepIndex: 0,
    }
    const input = wizardToCreateInput(state, digitalSteps)
    expect(input).not.toBeNull()
    expect(input!.callsign).toBe('Rust Devil')
    expect(input!.class_ref).toBe(engineerClass.id)
    expect(input!.ability_ref.schema_ref_id).toBe('ability-1')
    expect(input!.equipment_refs).toHaveLength(2)
  })

  test('returns null when ability is missing', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [equipmentStep.id]: { selectedIds: ['eq-1'], schemaName: 'equipment' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
      },
      currentStepIndex: 0,
    }
    expect(wizardToCreateInput(state, digitalSteps)).toBeNull()
  })

  test('includes optional text fields when provided', () => {
    const backgroundStep = digitalSteps.find(
      (s) => s.stepType === 'roll-table' && s.rollTable === 'Background'
    )!
    const mottoStep = digitalSteps.find(
      (s) => s.stepType === 'roll-table' && s.rollTable === 'Motto'
    )!
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
        [backgroundStep.id]: { selectedIds: [], textValue: 'Scavenger' },
        [mottoStep.id]: { selectedIds: [], textValue: 'Salvage or die' },
      },
      currentStepIndex: 0,
    }
    const input = wizardToCreateInput(state, digitalSteps)!
    expect(input.background).toBe('Scavenger')
    expect(input.motto).toBe('Salvage or die')
  })

  test('omits empty optional text fields', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
      },
      currentStepIndex: 0,
    }
    const input = wizardToCreateInput(state, digitalSteps)!
    expect(input.background).toBeUndefined()
    expect(input.motto).toBeUndefined()
    expect(input.keepsake).toBeUndefined()
    expect(input.appearance).toBeUndefined()
  })

  test('returns empty equipment_refs when no equipment selected', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [callsignStep.id]: { selectedIds: [], textValue: 'Rust Devil' },
      },
      currentStepIndex: 0,
    }
    const input = wizardToCreateInput(state, digitalSteps)!
    expect(input.equipment_refs).toEqual([])
  })

  test('trims callsign whitespace', () => {
    const state: WizardState = {
      selections: {
        [classStep.id]: { selectedIds: [engineerClass.id], schemaName: 'classes' },
        [abilityStep.id]: { selectedIds: ['ability-1'], schemaName: 'abilities' },
        [callsignStep.id]: { selectedIds: [], textValue: '  Rust Devil  ' },
      },
      currentStepIndex: 0,
    }
    const input = wizardToCreateInput(state, digitalSteps)!
    expect(input.callsign).toBe('Rust Devil')
  })
})

// ---------------------------------------------------------------------------
// resolveConstraintMax
// ---------------------------------------------------------------------------

describe('resolveConstraintMax', () => {
  test('returns static max when constraints.max is set', () => {
    // Equipment step has constraints.max = 2
    const result = resolveConstraintMax(equipmentStep, createInitialWizardState(), digitalSteps)
    expect(result).toBe(equipmentStep.constraints!.max!)
  })

  test('returns Infinity when no constraints', () => {
    const noConstraintStep: SURefObjectGuideStep = {
      id: 'test',
      name: 'Test',
      stepType: 'select-many',
      schema: ['systems'],
    }
    const result = resolveConstraintMax(noConstraintStep, createInitialWizardState(), [
      noConstraintStep,
    ])
    expect(result).toBe(Infinity)
  })

  test('resolves scalesWithField from chassis systemSlots', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
      },
      currentStepIndex: 0,
    }
    const result = resolveConstraintMax(systemsStep, state, mechDigitalSteps)
    expect(result).toBe(muleChassis.systemSlots)
  })

  test('resolves scalesWithField from chassis moduleSlots', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
      },
      currentStepIndex: 0,
    }
    const result = resolveConstraintMax(modulesStep, state, mechDigitalSteps)
    expect(result).toBe(muleChassis.moduleSlots)
  })

  test('returns Infinity when contextFrom selection is missing', () => {
    const result = resolveConstraintMax(systemsStep, createInitialWizardState(), mechDigitalSteps)
    expect(result).toBe(Infinity)
  })
})

// ---------------------------------------------------------------------------
// validateStep with dynamic constraints
// ---------------------------------------------------------------------------

describe('validateStep with dynamic constraints', () => {
  test('select-many with scalesWithField respects chassis slots', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: {
          selectedIds: Array.from({ length: muleChassis.systemSlots }, (_, i) => `sys-${i}`),
          schemaName: 'systems',
        },
      },
      currentStepIndex: 0,
    }
    // Exactly at max should be valid
    const result = validateStep(systemsStep, state, mechDigitalSteps)
    expect(result.isComplete).toBe(true)
    expect(result.canProceed).toBe(true)
  })

  test('select-many over dynamic max is incomplete but optional steps can proceed', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: {
          selectedIds: Array.from({ length: muleChassis.systemSlots + 1 }, (_, i) => `sys-${i}`),
          schemaName: 'systems',
        },
      },
      currentStepIndex: 0,
    }
    const result = validateStep(systemsStep, state, mechDigitalSteps)
    expect(result.isComplete).toBe(false)
    // Systems step is optional, so canProceed is always true
    expect(result.canProceed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Wizard reducer with dynamic constraints (mech guide)
// ---------------------------------------------------------------------------

describe('wizardReducer with dynamic constraints', () => {
  const mechReducer = createWizardReducer(mechDigitalSteps)

  test('SELECT_ENTITY on systems enforces dynamic max from chassis', () => {
    // Select chassis first
    let state = createInitialWizardState()
    state = mechReducer(state, {
      type: 'SELECT_ENTITY',
      stepId: chassisStep.id,
      entityId: muleChassis.id,
      schemaName: 'chassis',
    })

    // Fill up to max
    for (let i = 0; i < muleChassis.systemSlots; i++) {
      state = mechReducer(state, {
        type: 'SELECT_ENTITY',
        stepId: systemsStep.id,
        entityId: `sys-${i}`,
        schemaName: 'systems',
      })
    }
    expect(state.selections[systemsStep.id]!.selectedIds).toHaveLength(muleChassis.systemSlots)

    // Try to add one more — should be rejected
    const overState = mechReducer(state, {
      type: 'SELECT_ENTITY',
      stepId: systemsStep.id,
      entityId: 'sys-extra',
      schemaName: 'systems',
    })
    expect(overState.selections[systemsStep.id]!.selectedIds).toHaveLength(muleChassis.systemSlots)
  })

  test('changing chassis resets systems and modules selections', () => {
    let state = createInitialWizardState()
    // Select chassis
    state = mechReducer(state, {
      type: 'SELECT_ENTITY',
      stepId: chassisStep.id,
      entityId: muleChassis.id,
      schemaName: 'chassis',
    })
    // Select a system
    state = mechReducer(state, {
      type: 'SELECT_ENTITY',
      stepId: systemsStep.id,
      entityId: 'sys-1',
      schemaName: 'systems',
    })
    expect(state.selections[systemsStep.id]!.selectedIds).toHaveLength(1)

    // Change chassis — should reset systems and modules
    const anotherChassis = SalvageUnionReference.Chassis.find((c) => c.name !== 'Mule')!
    state = mechReducer(state, {
      type: 'SELECT_ENTITY',
      stepId: chassisStep.id,
      entityId: anotherChassis.id,
      schemaName: 'chassis',
    })
    expect(state.selections[systemsStep.id]).toBeUndefined()
    expect(state.selections[modulesStep.id]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// mechWizardToInstantiateInput
// ---------------------------------------------------------------------------

describe('mechWizardToInstantiateInput', () => {
  test('returns null when chassis is missing', () => {
    const state: WizardState = {
      selections: {
        [systemsStep.id]: { selectedIds: [firstSystem.id], schemaName: 'systems' },
      },
      currentStepIndex: 0,
    }
    expect(mechWizardToInstantiateInput(state, mechDigitalSteps)).toBeNull()
  })

  test('returns valid input with chassis only', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)
    expect(input).not.toBeNull()
    expect(input!.chassis_ref).toBe(muleChassis.id)
    expect(input!.pattern_items).toEqual([])
    expect(input!.pattern_name).toBeUndefined()
  })

  test('returns valid input with all fields', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: { selectedIds: [firstSystem.id], schemaName: 'systems' },
        [modulesStep.id]: { selectedIds: [firstModule.id], schemaName: 'modules' },
        [mechNameStep.id]: { selectedIds: [], textValue: 'Iron Mongrel' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)
    expect(input).not.toBeNull()
    expect(input!.chassis_ref).toBe(muleChassis.id)
    expect(input!.pattern_name).toBe('Iron Mongrel')
    expect(input!.pattern_items).toHaveLength(2)
    expect(input!.pattern_items[0]!.schema_name).toBe('systems')
    expect(input!.pattern_items[0]!.schema_ref_id).toBe(firstSystem.id)
    expect(input!.pattern_items[1]!.schema_name).toBe('modules')
    expect(input!.pattern_items[1]!.schema_ref_id).toBe(firstModule.id)
  })

  test('pattern_items have sequential sort_order', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: { selectedIds: ['s1', 's2'], schemaName: 'systems' },
        [modulesStep.id]: { selectedIds: ['m1'], schemaName: 'modules' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_items.map((p) => p.sort_order)).toEqual([0, 1, 2])
  })

  test('trims whitespace-only pattern name to undefined', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [mechNameStep.id]: { selectedIds: [], textValue: '   ' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_name).toBeUndefined()
  })

  test('returns valid input with modules only (no systems)', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [modulesStep.id]: { selectedIds: [firstModule.id], schemaName: 'modules' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_items).toHaveLength(1)
    expect(input.pattern_items[0]!.schema_name).toBe('modules')
    expect(input.pattern_items[0]!.sort_order).toBe(0)
  })

  test('returns valid input with systems only (no modules)', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [systemsStep.id]: { selectedIds: [firstSystem.id], schemaName: 'systems' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_items).toHaveLength(1)
    expect(input.pattern_items[0]!.schema_name).toBe('systems')
    expect(input.pattern_items[0]!.sort_order).toBe(0)
  })

  test('pattern_name is trimmed', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [mechNameStep.id]: { selectedIds: [], textValue: '  Iron Mongrel  ' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_name).toBe('Iron Mongrel')
  })

  test('systems are ordered before modules in pattern_items', () => {
    const state: WizardState = {
      selections: {
        [chassisStep.id]: { selectedIds: [muleChassis.id], schemaName: 'chassis' },
        [modulesStep.id]: { selectedIds: ['m1'], schemaName: 'modules' },
        [systemsStep.id]: { selectedIds: ['s1'], schemaName: 'systems' },
      },
      currentStepIndex: 0,
    }
    const input = mechWizardToInstantiateInput(state, mechDigitalSteps)!
    expect(input.pattern_items[0]!.schema_name).toBe('systems')
    expect(input.pattern_items[1]!.schema_name).toBe('modules')
  })
})
