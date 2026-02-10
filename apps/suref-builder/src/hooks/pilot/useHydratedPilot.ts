/**
 * Hook to fetch a pilot with hydrated abilities, equipment, and classes
 *
 * Combines usePilot and useEntitiesFor to provide a single hook that returns:
 * - The pilot data
 * - Hydrated abilities (with reference data and choices)
 * - Hydrated equipment (with reference data and choices)
 * - Selected class (hydrated entity with reference data and choices)
 * - Selected advanced class (hydrated entity with reference data and choices)
 * - Combined loading and error states
 */

import { useMemo } from 'react'
import { usePilot } from './usePilots'
import { useEntitiesFor } from '../suentity/useSUEntities'
import type { HydratedEntity } from '../../types/hydrated'
import type { Tables } from '../../types/database-generated.types'
import { isLocalId } from '../../lib/cacheHelpers'
import { combineQueryStates } from '../../lib/queryHelpers'

export interface HydratedPilot {
  pilot: Tables<'pilots'> | undefined
  abilities: HydratedEntity[]
  equipment: HydratedEntity[]
  modules: HydratedEntity[]
  systems: HydratedEntity[]
  selectedClass: HydratedEntity | undefined
  selectedAdvancedClass: HydratedEntity | undefined
  isLocal: boolean
  loading: boolean
  error: string | null
}

/**
 * Fetch a pilot with its hydrated abilities and equipment
 *
 * @param id - Pilot ID
 * @returns Pilot data with hydrated entities, selected classes, and combined states
 *
 * @example
 * ```tsx
 * const { pilot, abilities, equipment, selectedClass, selectedAdvancedClass, loading, error } = useHydratedPilot(pilotId)
 *
 * if (loading) return <Spinner />
 * if (error) return <Error message={error} />
 *
 * return (
 *   <div>
 *     <h1>{pilot?.callsign}</h1>
 *     <p>Class: {selectedClass?.ref.name}</p>
 *     <p>Advanced: {selectedAdvancedClass?.ref.name}</p>
 *     <AbilitiesList abilities={abilities} />
 *     <EquipmentList equipment={equipment} />
 *   </div>
 * )
 * ```
 */
export function useHydratedPilot(id: string | undefined): HydratedPilot {
  const { data: pilot, isLoading: pilotLoading, error: pilotError } = usePilot(id)
  const isLocal = isLocalId(id)

  const {
    data: entities = [],
    isLoading: entitiesLoading,
    error: entitiesError,
  } = useEntitiesFor('pilot', id)

  const abilities = useMemo(() => entities.filter((e) => e.schema_name === 'abilities'), [entities])

  const equipment = useMemo(() => entities.filter((e) => e.schema_name === 'equipment'), [entities])

  const modules = useMemo(() => entities.filter((e) => e.schema_name === 'modules'), [entities])

  const systems = useMemo(() => entities.filter((e) => e.schema_name === 'systems'), [entities])

  const selectedClass = useMemo(() => {
    // Find all class entities and filter for base class (has coreTrees, not hybrid)
    const classEntities = entities.filter((e) => e.schema_name === 'classes')
    return classEntities.find((classEntity) => {
      const ref = classEntity.ref as { coreTrees?: string[]; hybrid?: boolean }
      // Base classes have coreTrees and are not hybrid (hybrid !== true)
      return 'coreTrees' in ref && Array.isArray(ref.coreTrees) && ref.hybrid !== true
    })
  }, [entities])

  const selectedAdvancedClass = useMemo(() => {
    // Find all class entities and filter for hybrid class only (hybrid === true)
    const classEntities = entities.filter((e) => e.schema_name === 'classes')
    return classEntities.find((classEntity) => {
      const ref = classEntity.ref as { hybrid?: boolean }
      // Only hybrid classes (hybrid === true)
      return 'hybrid' in ref && ref.hybrid === true
    })
  }, [entities])

  const { loading, error } = combineQueryStates(
    { isLoading: pilotLoading, error: pilotError },
    { isLoading: entitiesLoading, error: entitiesError }
  )

  return {
    isLocal,
    pilot,
    abilities,
    equipment,
    modules,
    systems,
    selectedClass,
    selectedAdvancedClass,
    loading,
    error,
  }
}
