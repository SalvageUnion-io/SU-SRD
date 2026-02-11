import { supabase } from '../supabase'
import { createCrawlerSchema, updateCrawlerSchema } from '../validation'
import type { Crawler } from '../../types/common'

export async function fetchCrawler(id: string): Promise<Crawler> {
  const { data, error } = await supabase.from('crawlers').select('*').eq('id', id).single()

  if (error) throw error
  return data
}

export async function fetchUserCrawlers(): Promise<Crawler[]> {
  const { data, error } = await supabase
    .from('crawlers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createCrawler(
  input: { name: string; crawler_ref?: string | null },
  userId: string
): Promise<Crawler> {
  const validated = createCrawlerSchema.parse(input)
  const { data, error } = await supabase
    .from('crawlers')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCrawler(id: string, input: Record<string, unknown>): Promise<Crawler> {
  const validated = updateCrawlerSchema.parse(input)
  const { data, error } = await supabase
    .from('crawlers')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCrawler(id: string): Promise<void> {
  const { error } = await supabase.from('crawlers').delete().eq('id', id)
  if (error) throw error
}
