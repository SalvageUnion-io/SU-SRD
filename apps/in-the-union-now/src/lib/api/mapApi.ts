import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { MapLayerRow, MapLayerInsert, MapLayerUpdate } from '../../types/common'

export async function getMapLayers(campaignId: string): Promise<MapLayerRow[]> {
  const { data, error } = await supabase
    .from('map_layers')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) handleSupabaseError(error)
  return data!
}

export async function getMapLayer(
  campaignId: string,
  tier: string,
  parentZoneId: string | null
): Promise<MapLayerRow | null> {
  let query = supabase.from('map_layers').select('*').eq('campaign_id', campaignId).eq('tier', tier)

  if (parentZoneId === null) {
    query = query.is('parent_zone_id', null)
  } else {
    query = query.eq('parent_zone_id', parentZoneId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

export async function upsertMapLayer(input: MapLayerInsert): Promise<MapLayerRow> {
  const { data, error } = await supabase
    .from('map_layers')
    .upsert(input, { onConflict: 'campaign_id,tier,parent_zone_id' })
    .select()
    .single()
  if (error) handleSupabaseError(error)
  return data!
}

export async function updateMapLayer(layerId: string, input: MapLayerUpdate): Promise<MapLayerRow> {
  const { data, error } = await supabase
    .from('map_layers')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', layerId)
    .select()
    .single()
  if (error) handleSupabaseError(error)
  return data!
}

export async function deleteMapLayer(layerId: string): Promise<void> {
  const { error } = await supabase.from('map_layers').delete().eq('id', layerId)
  if (error) handleSupabaseError(error)
}
