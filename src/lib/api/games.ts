import { supabase } from '../supabase'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import { assertCanViewGame } from '../permissions'

export type GameRow = Tables<'games'>
export type GameMember = {
  user_id: string
  role: string
  user_name: string | null
  user_email?: string | null
}
export type GameInvite = Tables<'game_invites'>
export type ExternalLink = Tables<'external_links'>

/**
 * Fetch a single game by ID
 * Checks permissions before returning
 */
export async function fetchGame(gameId: string): Promise<GameRow> {
  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single()

  if (error) throw error
  if (!data) throw new Error('Game not found')

  const game = data as GameRow
  await assertCanViewGame(game)

  return game
}

/**
 * Fetch all games for the current user
 */
export async function fetchUserGames(userId: string): Promise<GameRow[]> {
  const { data: gameMembersData, error: gameMembersError } = await supabase
    .from('game_members')
    .select('game_id')
    .eq('user_id', userId)

  if (gameMembersError) throw gameMembersError

  const gameIds = (gameMembersData || []).map((gm) => gm.game_id)
  if (gameIds.length === 0) return []

  const { data, error } = await supabase.from('games').select('*').in('id', gameIds)

  if (error) throw error
  return (data || []) as GameRow[]
}

/**
 * Fetch user's games with their role in each game
 */
export async function fetchUserGamesWithRoles(
  userId: string
): Promise<Array<{ game_id: string; role: string }>> {
  const { data, error } = await supabase
    .from('game_members')
    .select('game_id, role')
    .eq('user_id', userId)

  if (error) throw error
  return (data || []) as Array<{ game_id: string; role: string }>
}

/**
 * Create a new game
 */
export async function createGame(
  name: string,
  description: string | null,
  createdBy: string
): Promise<GameRow> {
  const gameData: TablesInsert<'games'> = {
    name,
    description,
    created_by: createdBy,
  }

  const { data, error } = await supabase.from('games').insert(gameData).select().single()

  if (error) throw error
  if (!data) throw new Error('Failed to create game')
  return data as GameRow
}

/**
 * Get user's role in a game
 */
export async function getUserGameRole(gameId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('game_members')
    .select('role')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data?.role || 'player'
}

/**
 * Fetch all members of a game
 */
export async function fetchGameMembers(gameId: string): Promise<GameMember[]> {
  const { data, error } = await supabase.rpc('get_game_members', {
    p_game_id: gameId,
  })

  if (error) throw error
  return (data || []) as GameMember[]
}

/**
 * Create a game invite
 */
export async function createGameInvite(gameId: string): Promise<GameInvite> {
  const { data, error } = await supabase.rpc('create_game_invite', {
    p_game_id: gameId,
  })

  if (error) throw error
  if (!data) throw new Error('Failed to create invite')
  return data as GameInvite
}

/**
 * Expire a game invite
 */
export async function expireGameInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('expire_invite', {
    p_invite_id: inviteId,
  })

  if (error) throw error
}

/**
 * Redeem an invite code to join a game
 */
export async function redeemInviteCode(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    invite_code: inviteCode.trim(),
  })

  if (error) throw error
  if (!data) throw new Error('Invalid response from server')
  return data as string
}

/**
 * Delete an external link
 */
export async function deleteExternalLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('external_links').delete().eq('id', linkId)

  if (error) throw error
}

/**
 * Create an external link
 */
export async function createExternalLink(
  gameId: string,
  url: string,
  name: string
): Promise<ExternalLink> {
  const { data, error } = await supabase
    .from('external_links')
    .insert({ game_id: gameId, url, name })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create external link')
  return data as ExternalLink
}

/**
 * Fetch external links for a game (ordered by creation date)
 */
export async function fetchGameExternalLinks(gameId: string): Promise<ExternalLink[]> {
  const { data, error } = await supabase
    .from('external_links')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ExternalLink[]
}

/**
 * Fetch game invites (ordered by creation date)
 */
export async function fetchGameInvites(gameId: string): Promise<GameInvite[]> {
  const { data, error } = await supabase
    .from('game_invites')
    .select('id, code, created_by, expires_at, max_uses, uses, created_at, game_id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as GameInvite[]
}

/**
 * Update a game
 */
export async function updateGame(gameId: string, updates: Partial<GameRow>): Promise<void> {
  const { error } = await supabase.from('games').update(updates).eq('id', gameId)

  if (error) throw error
}

/**
 * Delete a game and all related data
 */
export async function deleteGame(gameId: string): Promise<void> {
  const { error: crawlerUpdateError } = await supabase
    .from('crawlers')
    .update({ game_id: null })
    .eq('game_id', gameId)
  if (crawlerUpdateError) throw crawlerUpdateError

  const { error: linksDeleteError } = await supabase
    .from('external_links')
    .delete()
    .eq('game_id', gameId)
  if (linksDeleteError) throw linksDeleteError

  const { error: invitesDeleteError } = await supabase
    .from('game_invites')
    .delete()
    .eq('game_id', gameId)
  if (invitesDeleteError) throw invitesDeleteError

  const { error: membersDeleteError } = await supabase
    .from('game_members')
    .delete()
    .eq('game_id', gameId)
  if (membersDeleteError) throw membersDeleteError

  const { error: gameDeleteError } = await supabase.from('games').delete().eq('id', gameId)
  if (gameDeleteError) throw gameDeleteError
}
