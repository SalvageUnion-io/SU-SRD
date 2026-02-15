import type { SURefObjectGuideStep } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/** Compute per-step display numbers, resetting when a step has a `section` value */
export function getStepNumbers(steps: SURefObjectGuideStep[]): number[] {
  const numbers: number[] = []
  let counter = 0
  for (const step of steps) {
    if (step.section) counter = 0
    counter++
    numbers.push(counter)
  }
  return numbers
}

/** Check if an entity passes a single guide step filter.
 *  If the field doesn't exist on the entity the filter is skipped. */
export function matchesFilter(
  entity: Record<string, unknown>,
  filter: { field: string; value?: string | number | boolean; min?: number; max?: number }
): boolean {
  const fieldValue = entity[filter.field]
  if (fieldValue === undefined) return true
  if (filter.value !== undefined) return fieldValue === filter.value
  if (filter.min !== undefined && (typeof fieldValue !== 'number' || fieldValue < filter.min))
    return false
  if (filter.max !== undefined && (typeof fieldValue !== 'number' || fieldValue > filter.max))
    return false
  return true
}

/** Enrich an entity with computed fields for filtering.
 *  For systems/modules, computes `hasDamage` from resolved actions. */
export function enrichForFiltering(
  entity: Record<string, unknown>,
  schemaName: string
): Record<string, unknown> {
  if ((schemaName === 'systems' || schemaName === 'modules') && Array.isArray(entity.actions)) {
    const hasDamage = (entity.actions as string[]).some((name) => {
      const action = SalvageUnionReference.Actions.find((a) => a.name === name)
      return action?.damage !== undefined
    })
    return { ...entity, hasDamage }
  }
  return entity
}
