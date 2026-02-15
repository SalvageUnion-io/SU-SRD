import type { SURefObjectGuideStep } from 'salvageunion-reference'

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
