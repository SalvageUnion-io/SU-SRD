import { SalvageUnionReference, getMaxSpBonus } from 'salvageunion-reference'
import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type {
  CargoRow,
  CrawlerRow,
  CrawlerUpdate,
  EntityRefRow,
  CreateCrawlerInput,
} from '../../types/common'
import type { Json } from '../../types/database-generated.types'

/** Compute crawler stats from TL1 tech level data, with optional crawler type SP bonus */
function getTL1Stats(crawlerRef?: string): { max_sp: number; upkeep: number } {
  const tl1 = SalvageUnionReference.CrawlerTechLevels.find((tl) => tl.techLevel === 1)
  const spBonus = crawlerRef ? getMaxSpBonus(crawlerRef) : 0
  return {
    max_sp: (tl1?.structurePoints ?? 20) + spBonus,
    upkeep: tl1?.upkeepCost ?? 5,
  }
}

export async function createCrawler(
  userId: string,
  gameId: string,
  input: CreateCrawlerInput
): Promise<CrawlerRow> {
  const stats = getTL1Stats(input.crawler_ref)

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
  // Use RPC or two-step update. Since we need atomic read-modify-write,
  // fetch current values first then update both fields.
  const crawler = await getCrawlerById(crawlerId)

  const fromValue = (crawler[fromField as keyof CrawlerRow] as number) - sourceConsumed
  const toValue = (crawler[toField as keyof CrawlerRow] as number) + targetAmount

  if (fromValue < 0) throw new Error('Not enough scrap to translate')

  const { data, error } = await supabase
    .from('crawlers')
    .update({ [fromField]: fromValue, [toField]: toValue })
    .eq('id', crawlerId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
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
