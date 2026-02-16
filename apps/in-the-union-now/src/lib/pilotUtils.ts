import {
  SalvageUnionReference,
  resultForTable,
  resultForColumnsTable,
  isColumnsTable,
} from 'salvageunion-reference'
import type { SURefObjectGuideStep, SURefGuide, EntitySchemaName } from 'salvageunion-reference'
import { matchesFilter, enrichForFiltering } from 'suref-react'
import type { CreatePilotInput, InstantiateMechInput, PatternItem } from '../types/common'

// ---------------------------------------------------------------------------
// Wizard Step Name Constants
// ---------------------------------------------------------------------------

/** Roll table names used for step lookups in wizard → API conversion */
const ROLL_TABLE_CALLSIGN = 'Callsign Table'
const ROLL_TABLE_BACKGROUND = 'Background'
const ROLL_TABLE_MOTTO = 'Motto'
const ROLL_TABLE_KEEPSAKE = 'Keepsake'
const ROLL_TABLE_APPEARANCE = 'Pilot Appearance'
const ROLL_TABLE_MECH_NAMES = 'Mech Pattern Names'

// ---------------------------------------------------------------------------
// Wizard State
// ---------------------------------------------------------------------------

export type StepSelection = {
  /** Selected entity IDs (for select-one/select-many) */
  selectedIds: string[]
  /** Schema name for the selected entities */
  schemaName?: string
  /** Freeform text value (for roll-table / freeform steps) */
  textValue?: string
  /** Roll value if rolled */
  rollValue?: number
}

export type WizardState = {
  /** Map of stepId → selection state */
  selections: Record<string, StepSelection>
  /** Currently active step index (in digital-only steps) */
  currentStepIndex: number
}

export type WizardAction =
  | { type: 'SELECT_ENTITY'; stepId: string; entityId: string; schemaName: string }
  | { type: 'DESELECT_ENTITY'; stepId: string; entityId: string }
  | { type: 'SET_TEXT'; stepId: string; value: string }
  | { type: 'SET_ROLL'; stepId: string; rollValue: number; textValue: string }
  | { type: 'GO_TO_STEP'; stepIndex: number }
  | { type: 'RESET' }

// ---------------------------------------------------------------------------
// Guide Step Helpers
// ---------------------------------------------------------------------------

/** Filter out paperOnly steps (digital-only view) */
export function getDigitalSteps(guide: SURefGuide): SURefObjectGuideStep[] {
  return guide.steps.filter((s) => !s.paperOnly)
}

/**
 * Resolve entities for a step, applying contextFrom filtering.
 * For ability steps with contextFrom, filters abilities by the selected class's coreTrees.
 */
export function resolveStepEntities(
  step: SURefObjectGuideStep,
  wizardState: WizardState
): { data: unknown; schemaName: string; disabled?: boolean }[] {
  if (!step.schema) return []
  const schemaName = step.schema[0]
  if (!schemaName || schemaName === 'actions') return []

  // If contextFrom is set, we need to filter abilities by the selected class's coreTrees
  let contextCoreTrees: string[] | undefined
  if (step.contextFrom) {
    const contextSelection = wizardState.selections[step.contextFrom]
    if (contextSelection?.selectedIds.length) {
      const classId = contextSelection.selectedIds[0]!
      const selectedClass = SalvageUnionReference.get('classes', classId)
      if (selectedClass && 'coreTrees' in selectedClass) {
        contextCoreTrees = (selectedClass as { coreTrees: string[] }).coreTrees
      }
    }
  }

  const filters = step.filters

  // No explicit entity list — return all entities from the schema (with filters)
  if (!step.schemaEntities || step.schemaEntities.length === 0) {
    const entities = SalvageUnionReference.findAllIn(schemaName, (e) => {
      // Hard filters still exclude entirely
      if (!filters || filters.length === 0) return true
      const enriched = enrichForFiltering(e as Record<string, unknown>, schemaName)
      return filters.every((f) => matchesFilter(enriched, f))
    })
    return entities.map((entity) => {
      // contextCoreTrees marks inaccessible entities as disabled (not hidden)
      const isDisabled =
        !!contextCoreTrees && 'tree' in entity && !contextCoreTrees.includes(String(entity.tree))
      return { data: entity, schemaName, ...(isDisabled ? { disabled: true } : {}) }
    })
  }

  const nameSet = new Set(step.schemaEntities)
  const entities = SalvageUnionReference.findAllIn(schemaName, (e) => {
    if (!nameSet.has(e.name)) return false
    // Hard filters still exclude entirely
    if (!filters || filters.length === 0) return true
    const enriched = enrichForFiltering(e as Record<string, unknown>, schemaName)
    return filters.every((f) => matchesFilter(enriched, f))
  })
  // Preserve the order from schemaEntities
  const byName = new Map(entities.map((e) => [e.name, e]))
  return step.schemaEntities
    .map((name) => {
      const entity = byName.get(name)
      if (!entity) return null
      const isDisabled =
        !!contextCoreTrees && 'tree' in entity && !contextCoreTrees.includes(String(entity.tree))
      return { data: entity, schemaName, ...(isDisabled ? { disabled: true } : {}) }
    })
    .filter(Boolean) as { data: unknown; schemaName: string; disabled?: boolean }[]
}

// ---------------------------------------------------------------------------
// Dynamic Constraint Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective max for a step, handling both static `constraints.max`
 * and dynamic `constraints.scalesWithField` (e.g., systemSlots on chassis).
 */
export function resolveConstraintMax(
  step: SURefObjectGuideStep,
  state: WizardState,
  steps: SURefObjectGuideStep[]
): number {
  // Static max takes priority
  if (step.constraints?.max !== undefined) return step.constraints.max

  // Dynamic max: look up the field on the entity selected in contextFrom
  if (step.constraints?.scalesWithField && step.contextFrom) {
    const contextStep = steps.find((s) => s.id === step.contextFrom)
    const contextSelection = state.selections[step.contextFrom]
    if (contextStep?.schema?.[0] && contextSelection?.selectedIds.length) {
      const entityId = contextSelection.selectedIds[0]!
      const schemaName = contextStep.schema[0] as EntitySchemaName
      const entity = SalvageUnionReference.get(schemaName, entityId)
      if (entity && step.constraints.scalesWithField in entity) {
        const value = (entity as unknown as Record<string, unknown>)[
          step.constraints.scalesWithField
        ]
        return typeof value === 'number' ? value : Infinity
      }
    }
  }

  return Infinity
}

// ---------------------------------------------------------------------------
// Roll Tables
// ---------------------------------------------------------------------------

/** Roll a d20 (1-20) */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

function formatRollResult(entry: { label?: string; value: string }): string {
  return entry.label ? `${entry.label}: ${entry.value}` : entry.value
}

/** Roll on a named roll table and return the text result */
export function rollOnTable(tableName: string): { text: string; roll: number } {
  const rollTable = SalvageUnionReference.RollTables.find((rt) => rt.name === tableName)
  if (!rollTable || !rollTable.table) {
    return { text: '', roll: 0 }
  }

  if (isColumnsTable(rollTable.table)) {
    const colRoll = rollD20()
    const entryRoll = rollD20()
    const result = resultForColumnsTable(rollTable.table, colRoll, entryRoll)
    if (result.success) {
      return { text: formatRollResult(result.result), roll: colRoll * 100 + entryRoll }
    }
    return { text: '', roll: 0 }
  }

  const roll = rollD20()
  const result = resultForTable(rollTable.table, roll)
  if (result.success) {
    return { text: formatRollResult(result.result), roll }
  }
  return { text: '', roll }
}

// ---------------------------------------------------------------------------
// Step Validation
// ---------------------------------------------------------------------------

export function validateStep(
  step: SURefObjectGuideStep,
  state: WizardState,
  steps?: SURefObjectGuideStep[]
): { isComplete: boolean; canProceed: boolean } {
  const selection = state.selections[step.id]

  // Optional steps with no selections can always be skipped
  if (step.optional && !selection) {
    return { isComplete: false, canProceed: true }
  }

  let result: { isComplete: boolean; canProceed: boolean }

  switch (step.stepType) {
    case 'info':
      result = { isComplete: true, canProceed: true }
      break

    case 'select-one':
      result = {
        isComplete: (selection?.selectedIds.length ?? 0) === 1,
        canProceed: (selection?.selectedIds.length ?? 0) === 1,
      }
      break

    case 'select-many': {
      const count = selection?.selectedIds.length ?? 0
      const max = steps
        ? resolveConstraintMax(step, state, steps)
        : (step.constraints?.max ?? Infinity)
      const min = step.constraints?.min ?? 1
      result = {
        isComplete: count >= min && count <= max,
        canProceed: count >= min && count <= max,
      }
      break
    }

    case 'roll-table':
    case 'freeform':
      result = {
        isComplete: !!selection?.textValue?.trim(),
        canProceed: !!selection?.textValue?.trim(),
      }
      break

    default:
      result = { isComplete: true, canProceed: true }
  }

  // Optional steps with selections: validate normally for isComplete,
  // but always allow proceeding unless selections exceed constraints
  if (step.optional) {
    return { isComplete: result.isComplete, canProceed: true }
  }

  return result
}

/** Check if all required steps are complete */
export function canSubmitWizard(state: WizardState, steps: SURefObjectGuideStep[]): boolean {
  return steps.every((step) => validateStep(step, state, steps).canProceed)
}

// ---------------------------------------------------------------------------
// Wizard Reducer
// ---------------------------------------------------------------------------

export function createInitialWizardState(): WizardState {
  return { selections: {}, currentStepIndex: 0 }
}

/**
 * Find step IDs that depend on a given step via contextFrom.
 * Used to reset downstream selections when a parent selection changes.
 */
function findDependentStepIds(steps: SURefObjectGuideStep[], stepId: string): string[] {
  return steps
    .filter((s) => s.contextFrom === stepId || s.dependsOn?.includes(stepId))
    .map((s) => s.id)
}

export function createWizardReducer(digitalSteps: SURefObjectGuideStep[]) {
  return function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
      case 'SELECT_ENTITY': {
        const step = digitalSteps.find((s) => s.id === action.stepId)
        const isSelectOne = step?.stepType === 'select-one'
        const existing = state.selections[action.stepId]

        let newSelectedIds: string[]
        if (isSelectOne) {
          // Toggle: re-clicking the selected entity de-selects it
          const currentIds = existing?.selectedIds ?? []
          newSelectedIds = currentIds.includes(action.entityId) ? [] : [action.entityId]
        } else {
          // Toggle: add if not present, enforce max (dynamic or static)
          const currentIds = existing?.selectedIds ?? []
          if (currentIds.includes(action.entityId)) {
            newSelectedIds = currentIds.filter((id) => id !== action.entityId)
          } else {
            const max = step ? resolveConstraintMax(step, state, digitalSteps) : Infinity
            if (currentIds.length >= max) {
              newSelectedIds = currentIds
            } else {
              newSelectedIds = [...currentIds, action.entityId]
            }
          }
        }

        const newSelections = {
          ...state.selections,
          [action.stepId]: {
            selectedIds: newSelectedIds,
            schemaName: action.schemaName,
          },
        }

        // If select-one changed, reset dependent steps
        if (isSelectOne) {
          const dependents = findDependentStepIds(digitalSteps, action.stepId)
          for (const depId of dependents) {
            delete newSelections[depId]
          }
        }

        // Auto-advance: if current step is now complete, move to next step
        const intermediateState = { ...state, selections: newSelections }
        let nextIndex = state.currentStepIndex
        if (step) {
          const { canProceed } = validateStep(step, intermediateState, digitalSteps)
          if (canProceed) {
            nextIndex = Math.min(state.currentStepIndex + 1, digitalSteps.length - 1)
          }
        }

        return { ...intermediateState, currentStepIndex: nextIndex }
      }

      case 'DESELECT_ENTITY': {
        const existing = state.selections[action.stepId]
        if (!existing) return state
        return {
          ...state,
          selections: {
            ...state.selections,
            [action.stepId]: {
              ...existing,
              selectedIds: existing.selectedIds.filter((id) => id !== action.entityId),
            },
          },
        }
      }

      case 'SET_TEXT':
        return {
          ...state,
          selections: {
            ...state.selections,
            [action.stepId]: {
              ...state.selections[action.stepId],
              selectedIds: state.selections[action.stepId]?.selectedIds ?? [],
              textValue: action.value,
            },
          },
        }

      case 'SET_ROLL':
        return {
          ...state,
          selections: {
            ...state.selections,
            [action.stepId]: {
              ...state.selections[action.stepId],
              selectedIds: state.selections[action.stepId]?.selectedIds ?? [],
              textValue: action.textValue,
              rollValue: action.rollValue,
            },
          },
          // Auto-advance: rolling always completes the step
          currentStepIndex: Math.min(state.currentStepIndex + 1, digitalSteps.length - 1),
        }

      case 'GO_TO_STEP':
        return {
          ...state,
          currentStepIndex: Math.max(0, Math.min(action.stepIndex, digitalSteps.length - 1)),
        }

      case 'RESET':
        return createInitialWizardState()

      default:
        return state
    }
  }
}

// ---------------------------------------------------------------------------
// Wizard → API Input Conversion
// ---------------------------------------------------------------------------

/**
 * Convert wizard state → CreatePilotInput for the API layer.
 * Returns null if required fields are missing.
 */
export function wizardToCreateInput(
  state: WizardState,
  steps: SURefObjectGuideStep[]
): CreatePilotInput | null {
  // Find steps by their stepType and schema
  const classStep = steps.find((s) => s.stepType === 'select-one' && s.schema?.[0] === 'classes')
  const abilityStep = steps.find(
    (s) => s.stepType === 'select-one' && s.schema?.[0] === 'abilities'
  )
  const equipmentStep = steps.find(
    (s) => s.stepType === 'select-many' && s.schema?.[0] === 'equipment'
  )
  const callsignStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_CALLSIGN
  )
  const backgroundStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_BACKGROUND
  )
  const mottoStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_MOTTO
  )
  const keepsakeStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_KEEPSAKE
  )
  const appearanceStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_APPEARANCE
  )

  const classRef = classStep ? state.selections[classStep.id]?.selectedIds[0] : undefined
  const abilityRef = abilityStep ? state.selections[abilityStep.id]?.selectedIds[0] : undefined
  const equipmentIds = equipmentStep ? (state.selections[equipmentStep.id]?.selectedIds ?? []) : []
  const callsign = callsignStep ? state.selections[callsignStep.id]?.textValue : undefined

  if (!classRef || !abilityRef || !callsign?.trim()) return null

  return {
    callsign: callsign.trim(),
    class_ref: classRef,
    ability_ref: { schema_name: 'abilities', schema_ref_id: abilityRef },
    equipment_refs: equipmentIds.map((id) => ({ schema_name: 'equipment', schema_ref_id: id })),
    background: backgroundStep
      ? state.selections[backgroundStep.id]?.textValue || undefined
      : undefined,
    motto: mottoStep ? state.selections[mottoStep.id]?.textValue || undefined : undefined,
    keepsake: keepsakeStep ? state.selections[keepsakeStep.id]?.textValue || undefined : undefined,
    appearance: appearanceStep
      ? state.selections[appearanceStep.id]?.textValue || undefined
      : undefined,
  }
}

/**
 * Convert mech wizard state → InstantiateMechInput for the API layer.
 * Returns null if the chassis step is missing.
 */
export function mechWizardToInstantiateInput(
  state: WizardState,
  steps: SURefObjectGuideStep[]
): InstantiateMechInput | null {
  const chassisStep = steps.find((s) => s.stepType === 'select-one' && s.schema?.[0] === 'chassis')
  const systemsStep = steps.find((s) => s.stepType === 'select-many' && s.schema?.[0] === 'systems')
  const modulesStep = steps.find((s) => s.stepType === 'select-many' && s.schema?.[0] === 'modules')
  const nameStep = steps.find((s) => s.rollTable === ROLL_TABLE_MECH_NAMES)

  const chassisRef = chassisStep ? state.selections[chassisStep.id]?.selectedIds[0] : undefined
  if (!chassisRef) return null

  const systemIds = systemsStep ? (state.selections[systemsStep.id]?.selectedIds ?? []) : []
  const moduleIds = modulesStep ? (state.selections[modulesStep.id]?.selectedIds ?? []) : []
  const patternName = nameStep ? state.selections[nameStep.id]?.textValue : undefined

  let sortOrder = 0
  const pattern_items: PatternItem[] = [
    ...systemIds.map((id) => ({
      schema_name: 'systems' as const,
      schema_ref_id: id,
      sort_order: sortOrder++,
    })),
    ...moduleIds.map((id) => ({
      schema_name: 'modules' as const,
      schema_ref_id: id,
      sort_order: sortOrder++,
    })),
  ]

  return {
    chassis_ref: chassisRef,
    pattern_name: patternName?.trim() || undefined,
    pattern_items,
  }
}
