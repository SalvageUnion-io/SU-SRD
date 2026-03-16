import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { generateInviteCode } from '../gameUtils'
import type { CampaignRow, CampaignMemberRow } from '../../types/common'

export async function listGames(userId: string, includeArchived = false): Promise<CampaignRow[]> {
  let query = supabase.from('campaign_members').select('campaigns!inner(*)').eq('user_id', userId)

  if (!includeArchived) {
    query = query.eq('campaigns.archived', false)
  }

  const { data, error } = await query.order('campaigns(updated_at)', { ascending: false })

  if (error) handleSupabaseError(error)
  return (data ?? [])
    .map((row) => (row as unknown as { campaigns: CampaignRow }).campaigns)
    .filter(Boolean)
}

export async function getGameById(gameId: string): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id,archived,crawler_id,created_at,created_by,invite_code,name,updated_at')
    .eq('id', gameId)
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getGameByCrawlerId(crawlerId: string): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id,archived,crawler_id,created_at,created_by,invite_code,name,updated_at')
    .eq('crawler_id', crawlerId)
    .maybeSingle()

  if (error) handleSupabaseError(error)
  return data
}

export async function getGameMembers(gameId: string): Promise<CampaignMemberRow[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('id,campaign_id,joined_at,role,user_id')
    .eq('campaign_id', gameId)
    .order('joined_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function createGame(userId: string, name: string): Promise<CampaignRow> {
  const inviteCode = generateInviteCode()

  // 1. Insert the campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name,
      created_by: userId,
      invite_code: inviteCode,
    })
    .select()
    .single()

  if (campaignError) handleSupabaseError(campaignError)

  // 2. Insert the creator as mediator
  const { error: memberError } = await supabase.from('campaign_members').insert({
    campaign_id: campaign!.id,
    user_id: userId,
    role: 'mediator',
  })

  if (memberError) handleSupabaseError(memberError)

  return campaign!
}

export async function deleteGame(gameId: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', gameId)
  if (error) handleSupabaseError(error)
}

export async function joinGame(userId: string, inviteCode: string): Promise<CampaignRow> {
  // 1. Find the campaign by invite code
  const { data: campaign, error: findError } = await supabase
    .from('campaigns')
    .select('id,archived,crawler_id,created_at,created_by,invite_code,name,updated_at')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (findError) handleSupabaseError(findError)

  // 2. Check if already a member
  const { data: existing } = await supabase
    .from('campaign_members')
    .select('id')
    .eq('campaign_id', campaign!.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return campaign!

  // 3. Insert as player
  const { error: joinError } = await supabase.from('campaign_members').insert({
    campaign_id: campaign!.id,
    user_id: userId,
    role: 'player',
  })

  if (joinError) handleSupabaseError(joinError)

  return campaign!
}

export async function regenerateInviteCode(gameId: string): Promise<string> {
  const newCode = generateInviteCode()
  const { error } = await supabase
    .from('campaigns')
    .update({ invite_code: newCode })
    .eq('id', gameId)

  if (error) handleSupabaseError(error)
  return newCode
}

export async function archiveGame(gameId: string, archived: boolean): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ archived })
    .eq('id', gameId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}
