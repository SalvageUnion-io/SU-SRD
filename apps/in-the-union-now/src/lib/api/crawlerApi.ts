import { SalvageUnionReference, getMaxSpBonus } from 'salvageunion-reference'
import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { computeCrawlerStatsFromTechLevel } from '../crawlerUtils'
import type {
  CargoRow,
  CrawlerRow,
  CrawlerUpdate,
  EntityRefRow,
  CreateCrawlerInput,
} from '../../types/common'
import type { Json } from '../../types/database-generated.types'

export async function createCrawler(
  userId: string,
  gameId: string,
  input: CreateCrawlerInput
): Promise<CrawlerRow> {
  const stats = computeCrawlerStatsFromTechLevel(1, input.crawler_ref)

  // 1. Insert the crawler row
  const { data: crawler, error: crawlerError } = await supabase
    .from('crawlers')
    .insert({
      user_id: userId,
      crawler_ref: input.crawler_ref,
      name: input.name ?? null,
      tag: input.tag ?? null,
      max_sp: stats.max_sp,
      current_sp: stats.max_sp,
      tech_level: 1,
      upkeep: stats.upkeep,
      bay_npcs: input.bay_npcs ?? {},
    })
    .select()
    .single()

  if (crawlerError) handleSupabaseError(crawlerError)

  // 2. Insert entity_refs for weapons (supports multiple via weapon_refs, falls back to weapon_ref)
  const weaponRefs = input.weapon_refs ?? (input.weapon_ref ? [input.weapon_ref] : [])
  if (weaponRefs.length > 0) {
    const refs = weaponRefs.map((ref, index) => ({
      parent_id: crawler!.id,
      parent_type: 'crawler' as const,
      schema_name: ref.schema_name,
      schema_ref_id: ref.schema_ref_id,
      sort_order: index,
      user_id: userId,
    }))
    const { error: refError } = await supabase.from('entity_refs').insert(refs)
    if (refError) handleSupabaseError(refError)
  }

  // 3. Link crawler to campaign
  const { error: linkError } = await supabase
    .from('campaigns')
    .update({ crawler_id: crawler!.id })
    .eq('id', gameId)

  if (linkError) handleSupabaseError(linkError)

  return crawler!
}

export async function getCrawlerById(crawlerId: string): Promise<CrawlerRow> {
  const { data, error } = await supabase.from('crawlers').select('*').eq('id', crawlerId).single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getCrawlerEntityRefs(crawlerId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select('*')
    .eq('parent_id', crawlerId)
    .eq('parent_type', 'crawler')
    .order('sort_order', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function deleteCrawler(crawlerId: string, gameId: string): Promise<void> {
  // Unlink crawler from campaign first
  const { error: unlinkError } = await supabase
    .from('campaigns')
    .update({ crawler_id: null })
    .eq('id', gameId)
    .eq('crawler_id', crawlerId)

  if (unlinkError) handleSupabaseError(unlinkError)

  // Delete the crawler (entity_refs, cargo, player_choices cascade via RLS or are orphaned)
  const { error } = await supabase.from('crawlers').delete().eq('id', crawlerId)
  if (error) handleSupabaseError(error)
}

export async function updateCrawler(crawlerId: string, input: CrawlerUpdate): Promise<CrawlerRow> {
  const { data, error } = await supabase
    .from('crawlers')
    .update(input)
    .eq('id', crawlerId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function translateScrap(
  crawlerId: string,
  fromField: string,
  toField: string,
  sourceConsumed: number,
  targetAmount: number
): Promise<CrawlerRow> {
  const { error } = await supabase.rpc('translate_scrap', {
    p_crawler_id: crawlerId,
    p_from_field: fromField,
    p_to_field: toField,
    p_source_consumed: sourceConsumed,
    p_target_amount: targetAmount,
  })

  if (error) handleSupabaseError(error)

  return getCrawlerById(crawlerId)
}

export async function listCargoForCrawler(crawlerId: string): Promise<CargoRow[]> {
  const { data, error } = await supabase
    .from('cargo')
    .select('*')
    .eq('parent_id', crawlerId)
    .eq('parent_type', 'crawler')
    .order('created_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function addCargoToCrawler(
  crawlerId: string,
  userId: string,
  input: {
    name: string
    amount?: number
    schema_name?: string
    schema_ref_id?: string
    metadata?: Record<string, unknown>
  }
): Promise<CargoRow> {
  const { data, error } = await supabase
    .from('cargo')
    .insert({
      parent_id: crawlerId,
      parent_type: 'crawler' as const,
      user_id: userId,
      name: input.name,
      amount: input.amount ?? 1,
      schema_name: input.schema_name ?? null,
      schema_ref_id: input.schema_ref_id ?? null,
      metadata: (input.metadata as Record<string, Json | undefined>) ?? null,
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function updateCargoItem(
  cargoId: string,
  input: { name?: string; amount?: number }
): Promise<CargoRow> {
  const { data, error } = await supabase
    .from('cargo')
    .update(input)
    .eq('id', cargoId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function deleteCargoItem(cargoId: string): Promise<void> {
  const { error } = await supabase.from('cargo').delete().eq('id', cargoId)

  if (error) handleSupabaseError(error)
}

export async function upgradeTechLevel(crawlerId: string): Promise<CrawlerRow> {
  // Fetch current crawler to get tech_level and crawler_ref
  const crawler = await getCrawlerById(crawlerId)
  const currentTL = SalvageUnionReference.CrawlerTechLevels.find(
    (tl) => tl.techLevel === crawler.tech_level
  )
  if (!currentTL?.upgradeCost) throw new Error('Crawler is at maximum tech level')
  if (crawler.upgrade_pool < currentTL.upgradeCost) throw new Error('Insufficient upgrade pool')

  const newTL = crawler.tech_level + 1
  const spBonus = crawler.crawler_ref ? getMaxSpBonus(crawler.crawler_ref) : 0
  const nextTLData = SalvageUnionReference.CrawlerTechLevels.find((tl) => tl.techLevel === newTL)
  if (!nextTLData) throw new Error('Invalid tech level')

  const newMaxSp = nextTLData.structurePoints + spBonus

  const { data, error } = await supabase
    .from('crawlers')
    .update({
      tech_level: newTL,
      upgrade_pool: 0,
      max_sp: newMaxSp,
      current_sp: Math.min(crawler.current_sp, newMaxSp),
      upkeep: nextTLData.upkeepCost,
    })
    .eq('id', crawlerId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function updateCrawlerWeapon(
  crawlerId: string,
  userId: string,
  oldRefId: string | null,
  newRef: { schema_name: 'systems'; schema_ref_id: string },
  sortOrder: number = 0
): Promise<void> {
  // Delete old weapon ref
  if (oldRefId) {
    const { error: delError } = await supabase
      .from('entity_refs')
      .delete()
      .eq('id', oldRefId)
      .eq('parent_id', crawlerId)

    if (delError) handleSupabaseError(delError)
  }

  // Insert new weapon ref
  const { error: insError } = await supabase.from('entity_refs').insert({
    parent_id: crawlerId,
    parent_type: 'crawler' as const,
    schema_name: newRef.schema_name,
    schema_ref_id: newRef.schema_ref_id,
    sort_order: sortOrder,
    user_id: userId,
  })

  if (insError) handleSupabaseError(insError)
}
