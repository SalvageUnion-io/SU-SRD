import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { generateInviteCode } from '../gameUtils'
import { mergeSessionState } from '../sessionStateUtils'
import { CampaignRowSchema, CampaignMemberRowSchema } from '../validation'
import { parseDatabaseResult, parseDatabaseResultArray } from './parseDatabaseResult'
import type { CampaignRow, CampaignMemberRow } from '../../types/common'
import type { SessionState } from '../sessionStateUtils'

export async function listGames(userId: string, includeArchived = false): Promise<CampaignRow[]> {
  let query = supabase.from('campaign_members').select('campaigns!inner(*)').eq('user_id', userId)

  if (!includeArchived) {
    query = query.eq('campaigns.archived', false)
  }

  const { data, error } = await query.order('campaigns(updated_at)', { ascending: false })

  if (error) handleSupabaseError(error)

  const rows = (data ?? []) as Array<{ campaigns: unknown }>
  const campaigns = rows.map((row) => row.campaigns).filter((c): c is unknown => Boolean(c))
  return parseDatabaseResultArray(campaigns, CampaignRowSchema, 'listGames')
}

export async function getGameById(gameId: string): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      'id,archived,crawler_id,created_at,created_by,invite_code,name,session_state,updated_at'
    )
    .eq('id', gameId)
    .single()

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, CampaignRowSchema, 'getGameById')
}

export async function getGameByCrawlerId(crawlerId: string): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      'id,archived,crawler_id,created_at,created_by,invite_code,name,session_state,updated_at'
    )
    .eq('crawler_id', crawlerId)
    .maybeSingle()

  if (error) handleSupabaseError(error)
  if (data === null) return null
  return parseDatabaseResult(data, CampaignRowSchema, 'getGameByCrawlerId')
}

export async function getGameMembers(gameId: string): Promise<CampaignMemberRow[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('id,campaign_id,joined_at,role,user_id')
    .eq('campaign_id', gameId)
    .order('joined_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return parseDatabaseResultArray(data, CampaignMemberRowSchema, 'getGameMembers')
}

export async function createGame(userId: string, name: string): Promise<CampaignRow> {
  const inviteCode = generateInviteCode()

  const { data, error } = await supabase.rpc('create_game', {
    p_user_id: userId,
    p_name: name,
    p_invite_code: inviteCode,
  })

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, CampaignRowSchema, 'createGame')
}

export async function deleteGame(gameId: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', gameId)
  if (error) handleSupabaseError(error)
}

export async function joinGame(userId: string, inviteCode: string): Promise<CampaignRow> {
  const { data, error } = await supabase.rpc('join_game', {
    p_user_id: userId,
    p_invite_code: inviteCode.toUpperCase(),
  })

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, CampaignRowSchema, 'joinGame')
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
  return parseDatabaseResult(data, CampaignRowSchema, 'archiveGame')
}

export async function updateSessionState(
  gameId: string,
  existing: SessionState | null,
  patch: Partial<SessionState>
): Promise<CampaignRow> {
  const merged = mergeSessionState(existing, patch)
  const { data, error } = await supabase
    .from('campaigns')
    .update({ session_state: merged })
    .eq('id', gameId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, CampaignRowSchema, 'updateSessionState')
}
