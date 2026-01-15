/**
 * Hook to fetch a mech with hydrated systems, modules, cargo, and chassis
 *
 * Combines useMech, useEntitiesFor, and useCargo to provide a single hook that returns:
 * - The mech data
 * - Hydrated systems (with reference data and choices)
 * - Hydrated modules (with reference data and choices)
 * - Hydrated cargo (with optional reference data)
 * - Selected chassis (hydrated entity with reference data and choices)
 * - Combined loading and error states
 */

import { useMemo } from 'react'
import { useMech } from './useMechs'
import { useEntitiesFor } from '../suentity/useSUEntities'
import { useCargo } from '../cargo/useCargo'
import type { HydratedEntity, HydratedCargo } from '../../types/hydrated'
import type { Tables } from '../../types/database-generated.types'
import { getSlotsRequired, getSalvageValue } from 'salvageunion-reference'
import { isLocalId } from '../../lib/cacheHelpers'
import { combineQueryStates } from '../../lib/queryHelpers'

export interface HydratedMech {
  mech: Tables<'mechs'> | undefined
  selectedChassis: HydratedEntity | undefined
  usedSystemSlots: number
  usedModuleSlots: number
  totalSalvageValue: number
  totalCargo: number
  systems: HydratedEntity[]
  modules: HydratedEntity[]
  cargo: HydratedCargo[]
  loading: boolean
  error: string | null
  isLocal: boolean
}

/**
 * Fetch a mech with its hydrated systems, modules, and cargo
 *
 * @param id - Mech ID
 * @returns Mech data with hydrated entities and combined states
 *
 * @example
 * ```tsx
 * const { mech, systems, modules, cargo, loading, error } = useHydratedMech(mechId)
 *
 * if (loading) return <Spinner />
 * if (error) return <Error message={error} />
 *
 * return (
 *   <div>
 *     <h1>{selectedChassis?.ref.name}</h1>
 *     <SystemsList systems={systems} />
 *     <ModulesList modules={modules} />
 *     <CargoList cargo={cargo} />
 *   </div>
 * )
 * ```
 */
export function useHydratedMech(id: string | undefined): HydratedMech {
  const { data: mech, isLoading: mechLoading, error: mechError } = useMech(id)

  const {
    data: entities = [],
    isLoading: entitiesLoading,
    error: entitiesError,
  } = useEntitiesFor('mech', id)

  const { data: cargo = [], isLoading: cargoLoading, error: cargoError } = useCargo('mech', id)

  const systems = useMemo(() => entities.filter((e) => e.schema_name === 'systems'), [entities])

  const modules = useMemo(() => entities.filter((e) => e.schema_name === 'modules'), [entities])

  const selectedChassis = useMemo(
    () => entities.find((e) => e.schema_name === 'chassis'),
    [entities]
  )

  const { loading, error } = combineQueryStates(
    { isLoading: mechLoading, error: mechError },
    { isLoading: entitiesLoading, error: entitiesError },
    { isLoading: cargoLoading, error: cargoError }
  )

  const usedSystemSlots = useMemo(
    () =>
      systems.reduce((sum, entity) => {
        const slotsRequired = getSlotsRequired(entity.ref)
        return sum + (slotsRequired ?? 0)
      }, 0),
    [systems]
  )

  const usedModuleSlots = useMemo(
    () =>
      modules.reduce((sum, entity) => {
        const slotsRequired = getSlotsRequired(entity.ref)
        return sum + (slotsRequired ?? 0)
      }, 0),
    [modules]
  )

  const totalSalvageValue = useMemo(() => {
    const systemValue = systems.reduce((sum, entity) => {
      const salvageValue = getSalvageValue(entity.ref) ?? 0
      return sum + salvageValue
    }, 0)

    const moduleValue = modules.reduce((sum, entity) => {
      const salvageValue = getSalvageValue(entity.ref) ?? 0
      return sum + salvageValue
    }, 0)

    const chassisValue = selectedChassis?.ref ? (getSalvageValue(selectedChassis.ref) ?? 0) : 0

    return systemValue + moduleValue + chassisValue
  }, [systems, modules, selectedChassis])

  const totalCargo = useMemo(
    () => cargo.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [cargo]
  )

  return {
    isLocal: isLocalId(id),
    selectedChassis,
    usedSystemSlots,
    usedModuleSlots,
    totalSalvageValue,
    totalCargo,
    mech,
    systems,
    modules,
    cargo,
    loading,
    error,
  }
}
