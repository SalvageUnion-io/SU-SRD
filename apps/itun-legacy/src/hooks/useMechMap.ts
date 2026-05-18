import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { mechKeys } from './useMechs'
import { getMechById } from '../lib/api/mechApi'
import type { MechRow } from '../types/common'

/**
 * Batch-fetches mechs by ID array. Returns a Map<string, MechRow> and loading state.
 * Populates individual mechKeys.detail(id) cache entries so downstream hooks hit warm cache.
 */
export function useMechMap(mechIds: string[]) {
  const queryClient = useQueryClient()

  const uniqueIds = useMemo(() => [...new Set(mechIds.filter(Boolean))], [mechIds])

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: mechKeys.detail(id),
      queryFn: async () => {
        const mech = await getMechById(id)
        // Populate individual cache entry
        queryClient.setQueryData(mechKeys.detail(id), mech)
        return mech
      },
    })),
  })

  const mechMap = useMemo(() => {
    const map = new Map<string, MechRow>()
    for (let i = 0; i < uniqueIds.length; i++) {
      const result = results[i]
      if (result?.data) {
        map.set(uniqueIds[i]!, result.data)
      }
    }
    return map
  }, [uniqueIds, results])

  const isLoading = results.some((r) => r.isLoading)

  return { mechMap, isLoading }
}
