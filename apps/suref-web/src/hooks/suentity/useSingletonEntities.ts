/**
 * Efficient hook for fetching singleton entities (crawler type, class, chassis) for multiple parents
 *
 * This hook batches queries to fetch singleton entities for dashboard views where we need
 * to display names for multiple crawlers/pilots/mechs without fetching all their entities.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

/**
 * Map of parent ID to singleton entity reference data
 */
export type SingletonEntityMap = Map<string, { name: string; ref_id: string } | null>

/**
 * Fetch singleton entities for multiple crawlers (crawler types)
 *
 * @param crawlerIds - Array of crawler IDs
 * @returns Map of crawler ID to crawler type data
 */
export function useCrawlerTypes(crawlerIds: string[]) {
  return useQuery({
    queryKey: ['singleton-entities', 'crawler-types', crawlerIds.sort()],
    queryFn: async (): Promise<SingletonEntityMap> => {
      if (crawlerIds.length === 0) {
        return new Map()
      }

      const { data: entities, error } = await supabase
        .from('suentities')
        .select('crawler_id, schema_ref_id')
        .in('crawler_id', crawlerIds)
        .eq('schema_name', 'crawler-types')

      if (error) {
        throw new Error(`Failed to fetch crawler types: ${error.message}`)
      }

      const map = new Map<string, { name: string; ref_id: string } | null>()

      for (const id of crawlerIds) {
        map.set(id, null)
      }

      for (const entity of entities || []) {
        if (entity.crawler_id) {
          const ref = SalvageUnionReference.get('crawlers', entity.schema_ref_id)
          if (ref) {
            map.set(entity.crawler_id, {
              name: ref.name,
              ref_id: entity.schema_ref_id,
            })
          }
        }
      }

      return map
    },
    enabled: crawlerIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch singleton entities for multiple pilots (classes and advanced classes)
 *
 * @param pilotIds - Array of pilot IDs
 * @returns Map of pilot ID to class data
 */
export function usePilotClasses(pilotIds: string[]) {
  return useQuery({
    queryKey: ['singleton-entities', 'pilot-classes', pilotIds.sort()],
    queryFn: async (): Promise<{
      classes: SingletonEntityMap
      advancedClasses: SingletonEntityMap
    }> => {
      if (pilotIds.length === 0) {
        return { classes: new Map(), advancedClasses: new Map() }
      }

      const { data: entities, error } = await supabase
        .from('suentities')
        .select('pilot_id, schema_name, schema_ref_id')
        .in('pilot_id', pilotIds)
        .in('schema_name', ['classes'])

      if (error) {
        throw new Error(`Failed to fetch pilot classes: ${error.message}`)
      }

      const classes = new Map<string, { name: string; ref_id: string } | null>()
      const advancedClasses = new Map<string, { name: string; ref_id: string } | null>()

      for (const id of pilotIds) {
        classes.set(id, null)
        advancedClasses.set(id, null)
      }

      for (const entity of entities || []) {
        if (entity.pilot_id) {
          const ref = SalvageUnionReference.get(
            entity.schema_name as SURefEnumSchemaName,
            entity.schema_ref_id
          )
          if (ref) {
            const data = {
              name: ref.name,
              ref_id: entity.schema_ref_id,
            }

            // Determine if this is a base class (can be selected as initial class)
            // Base classes have coreTrees, hybrid classes have hybrid=true
            const refClass = ref as { coreTrees?: string[]; hybrid?: boolean }
            const isBaseClass = 'coreTrees' in refClass && Array.isArray(refClass.coreTrees)
            const isHybridClass = 'hybrid' in refClass && refClass.hybrid === true

            if (isBaseClass && !isHybridClass) {
              classes.set(entity.pilot_id, data)
            } else {
              // Advanced version of base class or hybrid class
              advancedClasses.set(entity.pilot_id, data)
            }
          }
        }
      }

      return { classes, advancedClasses }
    },
    enabled: pilotIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch singleton entities for multiple mechs (chassis)
 *
 * @param mechIds - Array of mech IDs
 * @returns Map of mech ID to chassis data
 */
export function useMechChassis(mechIds: string[]) {
  return useQuery({
    queryKey: ['singleton-entities', 'mech-chassis', mechIds.sort()],
    queryFn: async (): Promise<SingletonEntityMap> => {
      if (mechIds.length === 0) {
        return new Map()
      }

      const { data: entities, error } = await supabase
        .from('suentities')
        .select('mech_id, schema_ref_id')
        .in('mech_id', mechIds)
        .eq('schema_name', 'chassis')

      if (error) {
        throw new Error(`Failed to fetch mech chassis: ${error.message}`)
      }

      const map = new Map<string, { name: string; ref_id: string } | null>()

      for (const id of mechIds) {
        map.set(id, null)
      }

      for (const entity of entities || []) {
        if (entity.mech_id) {
          const ref = SalvageUnionReference.get('chassis', entity.schema_ref_id)
          if (ref) {
            map.set(entity.mech_id, {
              name: ref.name,
              ref_id: entity.schema_ref_id,
            })
          }
        }
      }

      return map
    },
    enabled: mechIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
