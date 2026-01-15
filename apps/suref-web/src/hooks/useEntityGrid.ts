import { useState, useEffect, useCallback } from 'react'
import type { ValidTable } from '../types/common'
import { getUser, fetchUserEntities } from '../lib/api'
import { logger } from '../lib/logger'

export interface UseEntityGridConfig {
  table: ValidTable
  orderBy?: string
  orderAscending?: boolean
  filterField?: string
  filterValue?: string
}

export interface UseEntityGridResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Generic hook for loading entity grids from Supabase
 * Consolidates duplicate logic from GamesGrid, PilotsGrid, MechsGrid, CrawlersGrid
 */
export function useEntityGrid<T extends { id: string }>(
  config: UseEntityGridConfig
): UseEntityGridResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const user = await getUser()
      if (!user) throw new Error('Not authenticated')

      const data = await fetchUserEntities<T>(config.table, user.id, {
        filterField: config.filterField,
        filterValue: config.filterValue,
        orderBy: config.orderBy,
        orderAscending: config.orderAscending,
      })

      setItems(data)
    } catch (err) {
      logger.error(`Error loading ${config.table}:`, err)
      setError(err instanceof Error ? err.message : `Failed to load ${config.table}`)
    } finally {
      setLoading(false)
    }
  }, [config.table, config.filterField, config.filterValue, config.orderBy, config.orderAscending])

  useEffect(() => {
    loadItems()
  }, [config.table, config.filterField, config.filterValue, loadItems])

  return { items, loading, error, reload: loadItems }
}
