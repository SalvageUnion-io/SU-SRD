import { SalvageUnionReference, getMaxSpBonus } from 'salvageunion-reference'
import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { computeCrawlerStatsFromTechLevel } from '../crawlerUtils'
import type { Json } from '../../types/database-generated.types'
import type {
  CrawlerRow,
  CrawlerUpdate,
  DowntimeRecordRow,
  EntityRefRow,
  CreateCrawlerInput,
} from '../../types/common'
import type { OffloadReceipt } from '../tallySalvageUtils'
import type { RestoreReceipt } from '../restoreUtils'
import type { TradeResult } from '../tradeUtils'
import type { CraftReceipt } from '../craftUtils'
import type { TrainingReceipt } from '../trainingUtils'
import type { EquipmentReceipt } from '../equipmentUtils'
import type { RumourReceipt } from '../rumourUtils'

export async function createCrawler(
  userId: string,
  gameId: string,
  input: CreateCrawlerInput
): Promise<CrawlerRow> {
  const stats = computeCrawlerStatsFromTechLevel(1, input.crawler_ref)
  const weaponRefs = input.weapon_refs ?? (input.weapon_ref ? [input.weapon_ref] : [])

  const { data, error } = await supabase.rpc('create_crawler', {
    p_user_id: userId,
    p_game_id: gameId,
    p_crawler_ref: input.crawler_ref,
    p_name: input.name ?? null,
    p_tag: input.tag ?? null,
    p_max_sp: stats.max_sp,
    p_upkeep: stats.upkeep,
    p_bay_npcs: input.bay_npcs ?? {},
    p_weapon_refs: weaponRefs,
  })

  if (error) handleSupabaseError(error)
  return data as unknown as CrawlerRow
}

export async function getCrawlerById(crawlerId: string): Promise<CrawlerRow> {
  const { data, error } = await supabase
    .from('crawlers')
    .select(
      'id,active,bay_npcs,crawler_ref,created_at,current_sp,max_sp,name,notes,scrap_tl1,scrap_tl2,scrap_tl3,scrap_tl4,scrap_tl5,scrap_tl6,tag,tech_level,updated_at,upgrade_pool,upkeep,user_id,visible'
    )
    .eq('id', crawlerId)
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getCrawlerEntityRefs(crawlerId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select(
      'id,condition,created_at,metadata,parent_id,parent_type,schema_name,schema_ref_id,sort_order,updated_at,user_id'
    )
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

  // Optimistic concurrency: guard against concurrent upgrades
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
    .eq('tech_level', crawler.tech_level)
    .gte('upgrade_pool', currentTL.upgradeCost)
    .select()
    .maybeSingle()

  if (error) handleSupabaseError(error)
  if (!data) throw new Error('Upgrade failed — another change happened first. Please refresh.')
  return data
}

export async function getActiveDowntimeRecord(
  crawlerId: string
): Promise<DowntimeRecordRow | null> {
  const { data, error } = await supabase
    .from('downtime_records')
    .select(
      'id,closed_at,craft_receipts,crawler_id,created_at,customise_acknowledged,equipment_receipts,offload_receipts,pre_session_started,restore_receipts,rumour_receipts,trade_result,training_receipts,upkeep_paid,upkeep_result,user_id'
    )
    .eq('crawler_id', crawlerId)
    .is('closed_at', null)
    .maybeSingle()

  if (error) handleSupabaseError(error)
  return data
}

export async function setCrawlerDowntime(
  crawlerId: string,
  entering: boolean,
  userId: string
): Promise<DowntimeRecordRow> {
  let record: DowntimeRecordRow

  if (entering) {
    // 1. Create a new open downtime record
    const { data, error } = await supabase
      .from('downtime_records')
      .insert({ crawler_id: crawlerId, user_id: userId })
      .select()
      .single()

    if (error) handleSupabaseError(error)
    record = data!
  } else {
    // 1. Close the open downtime record
    const { data, error } = await supabase
      .from('downtime_records')
      .update({ closed_at: new Date().toISOString() })
      .eq('crawler_id', crawlerId)
      .is('closed_at', null)
      .select()
      .single()

    if (error) handleSupabaseError(error)
    record = data!
  }

  // 2. Cascade to all assigned pilots
  const pilotUpdate = entering ? { in_downtime: true, is_boarded: false } : { in_downtime: false }

  const { error: pilotError } = await supabase
    .from('pilots')
    .update(pilotUpdate)
    .eq('crawler_id', crawlerId)

  if (pilotError) handleSupabaseError(pilotError)

  return record
}

export async function payUpkeep(
  crawlerId: string,
  scrapDeductions: Record<string, number>,
  upgradePoolIncrease: number
): Promise<CrawlerRow> {
  const crawler = await getCrawlerById(crawlerId)
  const update: CrawlerUpdate = { upgrade_pool: crawler.upgrade_pool + upgradePoolIncrease }
  for (const [field, amount] of Object.entries(scrapDeductions)) {
    const current = crawler[field as keyof CrawlerRow] as number
    ;(update as Record<string, number>)[field] = current - amount
  }
  return updateCrawler(crawlerId, update)
}

export async function updateDowntimeRecord(
  recordId: string,
  input: {
    upkeep_paid?: boolean
    closed_at?: string
    upkeep_result?: Json
    restore_receipts?: Json
    trade_result?: Json
    craft_receipts?: Json
    training_receipts?: Json
    equipment_receipts?: Json
    customise_acknowledged?: Json
    rumour_receipts?: Json
    pre_session_started?: boolean
  }
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase
    .from('downtime_records')
    .update(input)
    .eq('id', recordId)
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
  const { error } = await supabase.rpc('update_crawler_weapon', {
    p_crawler_id: crawlerId,
    p_user_id: userId,
    p_old_ref_id: oldRefId,
    p_new_schema_name: newRef.schema_name,
    p_new_schema_ref_id: newRef.schema_ref_id,
    p_sort_order: sortOrder,
  })

  if (error) handleSupabaseError(error)
}

export async function saveOffloadReceipt(
  recordId: string,
  pilotId: string,
  receipt: OffloadReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'offload_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveRestoreReceipt(
  recordId: string,
  pilotId: string,
  receipt: RestoreReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'restore_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveTradeResult(
  recordId: string,
  result: TradeResult
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase
    .from('downtime_records')
    .update({ trade_result: result as unknown as Json })
    .eq('id', recordId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function saveCraftReceipt(
  recordId: string,
  pilotId: string,
  receipt: CraftReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'craft_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveTrainingReceipt(
  recordId: string,
  pilotId: string,
  receipt: TrainingReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'training_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveEquipmentReceipt(
  recordId: string,
  pilotId: string,
  receipt: EquipmentReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'equipment_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveCustomiseAcknowledged(
  recordId: string,
  pilotId: string
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'customise_acknowledged',
    p_pilot_id: pilotId,
    p_receipt: true as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}

export async function saveRumourReceipt(
  recordId: string,
  pilotId: string,
  receipt: RumourReceipt
): Promise<DowntimeRecordRow> {
  const { data, error } = await supabase.rpc('merge_downtime_receipt', {
    p_record_id: recordId,
    p_field: 'rumour_receipts',
    p_pilot_id: pilotId,
    p_receipt: receipt as unknown as Json,
  })
  if (error) handleSupabaseError(error)
  return data as unknown as DowntimeRecordRow
}
