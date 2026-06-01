import { useState, useCallback, useMemo } from 'react'
import type { ActionDisplayData } from '../lib/pilotActionUtils'

/** Action type values from ActionTypeSchema + Attacks (damage-based) */
export const ACTION_TYPES = [
  'Passive',
  'Free',
  'Reaction',
  'Turn',
  'Short',
  'Long',
  'DownTime',
  'Attacks',
] as const
export type ActionTypeFilter = (typeof ACTION_TYPES)[number]

export const CATEGORY_FILTERS = ['Pilot', 'Mech', 'Generic', 'Comrade'] as const
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number]

function matchesTypeFilter(action: ActionDisplayData, activeTypes: Set<ActionTypeFilter>): boolean {
  if (activeTypes.size === 0) return true
  if (activeTypes.has('Attacks') && action.hasDamage) return true
  return activeTypes.has(action.actionType as ActionTypeFilter)
}

function matchesCategoryFilter(
  action: ActionDisplayData,
  activeCategories: Set<CategoryFilter>
): boolean {
  if (activeCategories.size === 0) return true
  for (const cat of activeCategories) {
    if (cat === 'Pilot' && action.source === 'pilot') return true
    if (cat === 'Mech' && action.source === 'mech') return true
    if (cat === 'Generic' && action.source === 'general') return true
    if (cat === 'Comrade' && action.isComrade) return true
  }
  return false
}

function matchesFilters(
  action: ActionDisplayData,
  activeTypes: Set<ActionTypeFilter>,
  activeCategories: Set<CategoryFilter>
): boolean {
  return matchesTypeFilter(action, activeTypes) && matchesCategoryFilter(action, activeCategories)
}

export function filterActions(
  actions: ActionDisplayData[],
  activeTypes: Set<ActionTypeFilter>,
  activeCategories: Set<CategoryFilter>
): ActionDisplayData[] {
  return actions.filter((a) => matchesFilters(a, activeTypes, activeCategories))
}

export function useActionFilters() {
  const [activeTypes, setActiveTypes] = useState<Set<ActionTypeFilter>>(new Set())
  const [activeCategories, setActiveCategories] = useState<Set<CategoryFilter>>(new Set())

  const toggleType = useCallback((type: ActionTypeFilter) => {
    setActiveTypes((prev) => {
      if (prev.size === 0) return new Set([type])
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      if (next.size === ACTION_TYPES.length) return new Set()
      return next
    })
  }, [])

  const clearTypes = useCallback(() => {
    setActiveTypes(new Set())
  }, [])

  const toggleCategory = useCallback((cat: CategoryFilter) => {
    setActiveCategories((prev) => {
      if (prev.size === 0) return new Set([cat])
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      if (next.size === CATEGORY_FILTERS.length) return new Set()
      return next
    })
  }, [])

  const clearCategories = useCallback(() => {
    setActiveCategories(new Set())
  }, [])

  const applyFilters = useCallback(
    (actions: ActionDisplayData[]) => filterActions(actions, activeTypes, activeCategories),
    [activeTypes, activeCategories]
  )

  /** Which action types are actually present in the current action pool */
  const getAvailableTypes = useCallback((actions: ActionDisplayData[]): Set<ActionTypeFilter> => {
    const types = new Set<ActionTypeFilter>()
    for (const a of actions) {
      if (ACTION_TYPES.includes(a.actionType as ActionTypeFilter)) {
        types.add(a.actionType as ActionTypeFilter)
      }
      if (a.hasDamage) types.add('Attacks')
    }
    return types
  }, [])

  /** Which categories are actually present in the current action pool */
  const getAvailableCategories = useCallback(
    (actions: ActionDisplayData[]): Set<CategoryFilter> => {
      const cats = new Set<CategoryFilter>()
      for (const a of actions) {
        if (a.source === 'pilot') cats.add('Pilot')
        if (a.source === 'mech') cats.add('Mech')
        if (a.source === 'general') cats.add('Generic')
        if (a.isComrade) cats.add('Comrade')
      }
      return cats
    },
    []
  )

  const checkMatch = useCallback(
    (action: ActionDisplayData) => matchesFilters(action, activeTypes, activeCategories),
    [activeTypes, activeCategories]
  )

  const hasActiveFilters = useMemo(
    () => activeTypes.size > 0 || activeCategories.size > 0,
    [activeTypes, activeCategories]
  )

  return {
    activeTypes,
    activeCategories,
    toggleType,
    clearTypes,
    toggleCategory,
    clearCategories,
    applyFilters,
    checkMatch,
    getAvailableTypes,
    getAvailableCategories,
    hasActiveFilters,
  }
}
