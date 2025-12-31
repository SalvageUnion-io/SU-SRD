import { useCallback, useEffect, useState } from 'react'
import type { Database } from '../types/database-generated.types'
import { getUser, fetchUserEntities } from '../lib/api'
import { logger } from '../lib/logger'

type TableName = keyof Database['public']['Tables']

interface UseEntityRelationshipsConfig {
  table: TableName
  selectFields?: string
  orderBy?: string
  filterField?: string
  filterValue?: string
}

/**
 * Generic hook for loading entity relationships from Supabase.
 * Automatically filters by the current user's ID.
 *
 * @example
 * ```tsx
 * const { items: crawlers, loading } = useEntityRelationships({
 *   table: 'crawlers',
 *   selectFields: 'id, name, game_id',
 *   orderBy: 'name',
 * })
 * ```
 */
export function useEntityRelationships<T extends { id: string } = { id: string; name: string }>(
  config: UseEntityRelationshipsConfig
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const user = await getUser()
      if (!user) return

      const data = await fetchUserEntities<T>(config.table, user.id, {
        filterField: config.filterField,
        filterValue: config.filterValue,
        orderBy: config.orderBy,
      })

      setItems(data)
    } catch (err) {
      logger.error(`Error loading ${config.table}:`, err)
      setError(err instanceof Error ? err.message : `Failed to load ${config.table}`)
    } finally {
      setLoading(false)
    }
  }, [config.table, config.orderBy, config.filterField, config.filterValue])

  useEffect(() => {
    load()
  }, [load])

  return { items, loading, error, reload: load }
}
