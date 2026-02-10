import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database-generated.types'

type CrawlerRow = Tables<'crawlers'>

/**
 * Hook to fetch all crawlers available to the current user
 *
 * Returns crawlers that the user can see based on RLS policies:
 * - Crawlers owned by the user
 * - Crawlers from games the user is a member of
 * - Public crawlers
 *
 * @returns Query result with array of crawlers
 */
export function useAvailableCrawlers() {
  return useQuery({
    queryKey: ['available-crawlers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crawlers')
        .select('id, name, game_id, user_id, active, private')
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []) as Pick<
        CrawlerRow,
        'id' | 'name' | 'game_id' | 'user_id' | 'active' | 'private'
      >[]
    },
  })
}
