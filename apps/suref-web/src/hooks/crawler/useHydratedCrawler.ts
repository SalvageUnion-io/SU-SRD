/**
 * Hook to fetch a crawler with hydrated cargo, crawler type, and bays
 *
 * Combines useCrawler, useCargo, and useEntitiesFor to provide a single hook that returns:
 * - The crawler data
 * - Hydrated cargo (with optional reference data)
 * - Selected crawler type (hydrated entity with reference data and choices)
 * - Hydrated bays (with reference data, choices, and metadata)
 * - Combined loading and error states
 */

import { useCrawler } from './useCrawlers'
import { useCargo } from '../cargo/useCargo'
import { useEntitiesFor } from '../suentity/useSUEntities'
import type { HydratedCargo, HydratedEntity, HydratedBay } from '../../types/hydrated'
import type { Tables } from '../../types/database-generated.types'
import { isLocalId } from '../../lib/cacheHelpers'
import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { combineQueryStates } from '../../lib/queryHelpers'

export interface HydratedCrawler {
  crawler: Tables<'crawlers'> | undefined
  cargo: HydratedCargo[]
  bays: HydratedBay[]
  storageBay: HydratedBay | undefined
  selectedCrawlerType: HydratedEntity | undefined
  loading: boolean
  isLocal: boolean
  maxSP: number
  upkeep: string
  totalCargo: number
  error: string | null
}

/**
 * Fetch a crawler with its hydrated cargo
 *
 * @param id - Crawler ID
 * @returns Crawler data with hydrated cargo and combined states
 *
 * @example
 * ```tsx
 * const { crawler, cargo, loading, error } = useHydratedCrawler(crawlerId)
 *
 * if (loading) return <Spinner />
 * if (error) return <Error message={error} />
 *
 * return (
 *   <div>
 *     <h1>{crawler?.name}</h1>
 *     <CargoList cargo={cargo} />
 *   </div>
 * )
 * ```
 */
export function useHydratedCrawler(id: string | undefined): HydratedCrawler {
  const { data: crawler, isLoading: crawlerLoading, error: crawlerError } = useCrawler(id)

  const { data: cargo = [], isLoading: cargoLoading, error: cargoError } = useCargo('crawler', id)

  const {
    data: entities = [],
    isLoading: entitiesLoading,
    error: entitiesError,
  } = useEntitiesFor('crawler', id)

  const isLocal = isLocalId(id)

  const allTechLevels = SalvageUnionReference.CrawlerTechLevels.all()

  const selectedCrawlerType = useMemo(
    () => entities.find((e) => e.schema_name === 'crawlers'),
    [entities]
  )

  const bays = useMemo(
    () => entities.filter((e) => e.schema_name === 'crawler-bays') as HydratedBay[],
    [entities]
  )

  const totalCargo = useMemo(
    () => cargo.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [cargo]
  )

  const upkeep = useMemo(() => {
    const techLevel = crawler?.tech_level ?? 1
    return `5 TL${techLevel}`
  }, [crawler?.tech_level])

  const maxSP = useMemo(() => {
    if (!selectedCrawlerType?.ref) return 0
    const techLevel = crawler?.tech_level ?? 1
    const techLevelData = allTechLevels.find((tl) => tl.techLevel === techLevel)
    return techLevelData?.structurePoints ?? 0
  }, [selectedCrawlerType?.ref, crawler?.tech_level, allTechLevels])

  const { loading, error } = combineQueryStates(
    { isLoading: crawlerLoading, error: crawlerError },
    { isLoading: cargoLoading, error: cargoError },
    { isLoading: entitiesLoading, error: entitiesError }
  )

  const storageBay = useMemo(() => bays.find((b) => b.ref.name === 'Storage Bay'), [bays])

  return {
    storageBay,
    maxSP,
    upkeep,
    totalCargo,
    selectedCrawlerType,
    isLocal,
    crawler,
    cargo,
    bays,
    loading,
    error,
  }
}
