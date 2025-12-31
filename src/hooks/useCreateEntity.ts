import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { TablesInsert } from '../types/database-generated.types'
import type { ValidTable, CrawlerNPC } from '../types/common'
import { getUser, createEntity as createEntityAPI } from '../lib/api'
import { useCreateCrawler } from './crawler/useCrawlers'
import { logger } from '../lib/logger'

interface useCreateEntityConfig<T extends ValidTable> {
  table: T
  navigationPath: (id: string) => string
  placeholderData?: Partial<TablesInsert<T>>
}

interface useCreateEntityResult {
  createEntity: () => Promise<void>
  isLoading: boolean
  error: string | null
}

const initialNPC: CrawlerNPC = {
  name: '', // Name is now stored in player_choices, but kept here for type compatibility
  notes: '',
  hitPoints: 0,
  damage: 0,
}

const defaults: Record<ValidTable, Record<string, unknown>> = {
  mechs: {
    pattern: 'New Mech',
    current_damage: 0,
    current_heat: 0,
    current_ep: 0,
  },
  pilots: {
    callsign: 'New Pilot',
    max_hp: 10,
    max_ap: 5,
    current_damage: 0,
    current_ap: 0,
  },
  crawlers: {
    name: 'New Crawler',
    current_damage: 0,
    scrap_tl_one: 0,
    scrap_tl_two: 0,
    scrap_tl_three: 0,
    scrap_tl_four: 0,
    scrap_tl_five: 0,
    scrap_tl_six: 0,
    npc: initialNPC,
    tech_level: 1,
  },
  games: {
    name: 'Unknown Game',
  },
  external_links: {
    name: 'Unknown Link',
    url: 'https://example.com',
  },
  game_invites: {
    code: 'UNKNOWN',
  },
  game_members: {
    role: 'member',
  },
  suentities: {
    schema_name: 'abilities',
    schema_ref_id: '',
  },
  cargo: {
    name: 'Unknown Cargo',
  },
  player_choices: {
    choice_ref_id: '',
    value: '',
  },
}

export { defaults }

/**
 * Hook for creating entities directly in Supabase with loading state and navigation
 * Creates a record with placeholder values and navigates to the show page
 *
 * @param config Configuration object with table name, navigation path, and optional placeholder data
 * @returns Object with createEntity function, isLoading state, and error state
 */
export function useCreateEntity<T extends ValidTable>(
  config: useCreateEntityConfig<T>
): useCreateEntityResult {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createCrawlerMutation = useCreateCrawler()

  const getPlaceholderData = useCallback((): Record<string, unknown> => {
    return {
      ...defaults[config.table],
      ...config.placeholderData,
    }
  }, [config.table, config.placeholderData])

  const createEntity = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const user = await getUser()
      if (!user) throw new Error('Not authenticated')

      const placeholderData = getPlaceholderData()
      let data: Record<string, unknown>

      if (config.table === 'games' || config.table === 'game_invites') {
        data = {
          ...placeholderData,
          created_by: user.id,
        }
      } else if (config.table === 'external_links') {
        data = placeholderData
      } else {
        data = {
          ...placeholderData,
          user_id: user.id,
        }
      }

      let createdEntity: { id: string }
      if (config.table === 'crawlers') {
        createdEntity = await createCrawlerMutation.mutateAsync(data as never)
      } else {
        createdEntity = await createEntityAPI(config.table, data as never)
      }

      const navigationUrl = config.navigationPath(createdEntity.id)
      navigate({ to: navigationUrl })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to create ${config.table}`
      logger.error(`Error creating ${config.table}:`, err)
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [config, getPlaceholderData, navigate, createCrawlerMutation])

  return {
    createEntity,
    isLoading,
    error,
  }
}
