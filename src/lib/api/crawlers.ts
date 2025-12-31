import { supabase } from '../supabase'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import { assertCanViewCrawler } from '../permissions'

export type CrawlerRow = Tables<'crawlers'>

/**
 * Fetch crawler for a specific game
 * Checks permissions before returning
 */
export async function fetchGameCrawler(gameId: string): Promise<CrawlerRow | null> {
  const { data, error } = await supabase
    .from('crawlers')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const crawler = data as CrawlerRow
  await assertCanViewCrawler(crawler)

  return crawler
}

/**
 * Create a new crawler
 */
export async function createCrawler(userId: string): Promise<CrawlerRow> {
  const crawlerData: TablesInsert<'crawlers'> = {
    name: 'Unknown Name',
    current_damage: 0,
    user_id: userId,
  }

  const { data, error } = await supabase.from('crawlers').insert(crawlerData).select().single()

  if (error) throw error
  if (!data) throw new Error('Failed to create crawler')
  return data as CrawlerRow
}

/**
 * Update a crawler
 * If setting active to true, automatically deactivates all other crawlers for the same game
 */
export async function updateCrawler(
  crawlerId: string,
  updates: Partial<CrawlerRow>
): Promise<void> {
  if (updates.active === true) {
    const { data: crawler, error: fetchError } = await supabase
      .from('crawlers')
      .select('game_id')
      .eq('id', crawlerId)
      .single()

    if (fetchError) throw fetchError

    if (crawler?.game_id) {
      const { error: deactivateError } = await supabase
        .from('crawlers')
        .update({ active: false })
        .eq('game_id', crawler.game_id)
        .neq('id', crawlerId)

      if (deactivateError) throw deactivateError
    }
  }

  const { error } = await supabase.from('crawlers').update(updates).eq('id', crawlerId)

  if (error) throw error
}
