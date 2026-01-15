/**
 * Hook to aggregate actions from pilot, active mech, and crawler
 *
 * Combines actions from multiple sources:
 * - Pilot abilities (with actions)
 * - Active mech chassis abilities, systems, and modules
 * - Crawler abilities (if pilot has crawler_id)
 *
 * Groups actions by source for display in Universal Live Sheet
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SURefMetaAction, SURefChassis, SURefCrawler } from 'salvageunion-reference'
import { extractActions, getChassisAbilities } from 'salvageunion-reference'
import { useHydratedPilot } from './pilot/useHydratedPilot'
import { useHydratedMech } from './mech/useHydratedMech'
import { useHydratedCrawler } from './crawler/useHydratedCrawler'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database-generated.types'

type Mech = Tables<'mechs'>

export interface UniversalActions {
  pilot: SURefMetaAction[]
  mech: SURefMetaAction[]
  crawler: SURefMetaAction[]
  loading: boolean
  error: string | null
}

/**
 * Aggregate actions from pilot, active mech, and crawler
 *
 * @param pilotId - Pilot ID
 * @returns Actions grouped by source (pilot, mech, crawler) with loading/error states
 */
export function useUniversalActions(pilotId: string | undefined): UniversalActions {
  const { pilot, abilities, loading: pilotLoading, error: pilotError } = useHydratedPilot(pilotId)

  // Query for active mech
  const {
    data: activeMech,
    isLoading: mechLoading,
    error: mechError,
  } = useQuery({
    queryKey: ['active-mech', pilotId],
    queryFn: async () => {
      if (!pilotId) return null

      const { data, error } = await supabase
        .from('mechs')
        .select('*')
        .eq('pilot_id', pilotId)
        .eq('active', true)
        .maybeSingle()

      if (error) throw error
      return (data as Mech | null) ?? null
    },
    enabled: !!pilotId,
  })

  // Get hydrated mech data if active mech exists
  const {
    selectedChassis,
    systems,
    modules,
    loading: hydratedMechLoading,
    error: hydratedMechError,
  } = useHydratedMech(activeMech?.id)

  // Get crawler data if pilot has crawler_id
  const {
    selectedCrawlerType,
    loading: crawlerLoading,
    error: crawlerError,
  } = useHydratedCrawler(pilot?.crawler_id ?? undefined)

  const loading = pilotLoading || mechLoading || hydratedMechLoading || crawlerLoading
  const error =
    (pilotError ? String(pilotError) : null) ||
    (mechError ? String(mechError) : null) ||
    (hydratedMechError ? String(hydratedMechError) : null) ||
    (crawlerError ? String(crawlerError) : null)

  // Extract pilot actions from abilities
  const pilotActions = useMemo(() => {
    const actions: SURefMetaAction[] = []
    for (const ability of abilities) {
      const abilityActions = extractActions(ability.ref)
      if (abilityActions) {
        actions.push(...abilityActions)
      }
    }
    return actions
  }, [abilities])

  // Extract mech actions (chassis abilities, systems, modules)
  const mechActions = useMemo(() => {
    const actions: SURefMetaAction[] = []

    // Chassis abilities
    if (selectedChassis?.ref) {
      const chassisRef = selectedChassis.ref as SURefChassis
      const chassisAbilities = getChassisAbilities(chassisRef)
      if (chassisAbilities) {
        actions.push(...chassisAbilities)
      }
    }

    // Systems actions
    for (const system of systems) {
      const systemActions = extractActions(system.ref)
      if (systemActions) {
        actions.push(...systemActions)
      }
    }

    // Modules actions
    for (const module of modules) {
      const moduleActions = extractActions(module.ref)
      if (moduleActions) {
        actions.push(...moduleActions)
      }
    }

    return actions
  }, [selectedChassis, systems, modules])

  // Extract crawler actions
  const crawlerActions = useMemo(() => {
    if (!selectedCrawlerType?.ref) return []

    const crawlerRef = selectedCrawlerType.ref as SURefCrawler
    const actions = extractActions(crawlerRef)
    return actions ?? []
  }, [selectedCrawlerType])

  return {
    pilot: pilotActions,
    mech: mechActions,
    crawler: crawlerActions,
    loading,
    error,
  }
}
