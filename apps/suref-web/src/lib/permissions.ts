import { supabase } from './supabase'
import type { Tables } from '../types/database-generated.types'

type GameRow = Tables<'games'>
type CrawlerRow = Tables<'crawlers'>
type PilotRow = Tables<'pilots'>
type MechRow = Tables<'mechs'>

/**
 * Permission error thrown when user doesn't have access to a resource
 */
export class PermissionError extends Error {
  constructor(message: string = 'You do not have permission to view this resource') {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * Get the current authenticated user ID
 * Returns null if not authenticated
 */
async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * Check if the current user owns an entity (synchronous check)
 * @param entityUserId - The user_id field from the entity
 * @param currentUserId - The current authenticated user's ID (pass from React component)
 */
export function isOwner(entityUserId: string, currentUserId: string | null): boolean {
  if (!currentUserId) return false
  return entityUserId === currentUserId
}

/**
 * Check if the current user is a mediator for a game (synchronous check)
 * @param gameMembers - Array of game members with user_id and role
 * @param currentUserId - The current authenticated user's ID
 */
export function isGameMediator(
  gameMembers: Array<{ user_id: string; role: string }>,
  currentUserId: string | null
): boolean {
  if (!currentUserId) return false
  return gameMembers.some((m) => m.role === 'mediator' && m.user_id === currentUserId)
}

/**
 * Check if a user is a member of a game
 */
async function isUserInGame(userId: string, gameId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('game_members')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return !!data
}

/**
 * Check if user can view a game
 * - Public games (private=false): Anyone can view (logged in or not)
 * - Private games (private=true): Only members can view
 */
export async function canViewGame(game: GameRow): Promise<boolean> {
  if (!game.private) return true

  const userId = await getCurrentUserId()
  if (!userId) return false

  return isUserInGame(userId, game.id)
}

/**
 * Check if user can view a crawler
 * - Public crawlers (private=false): Anyone can view
 * - Private crawlers (private=true): Owner or users in the crawler's game can view
 */
export async function canViewCrawler(crawler: CrawlerRow): Promise<boolean> {
  if (!crawler.private) return true

  const userId = await getCurrentUserId()
  if (!userId) return false

  if (crawler.user_id === userId) return true

  if (!crawler.game_id) return false

  return isUserInGame(userId, crawler.game_id)
}

/**
 * Check if user can view a pilot
 * - Public pilots (private=false): Anyone can view
 * - Private pilots (private=true): Owner or users in the pilot's crawler's game can view
 */
export async function canViewPilot(pilot: PilotRow): Promise<boolean> {
  if (!pilot.private) return true

  const userId = await getCurrentUserId()
  if (!userId) return false

  if (pilot.user_id === userId) return true

  if (!pilot.crawler_id) return false

  const { data: crawler, error } = await supabase
    .from('crawlers')
    .select('game_id')
    .eq('id', pilot.crawler_id)
    .maybeSingle()

  if (error) throw error
  if (!crawler || !crawler.game_id) return false

  return isUserInGame(userId, crawler.game_id)
}

/**
 * Check if user can view a mech
 * - Public mechs (private=false): Anyone can view
 * - Private mechs (private=true): Owner or users in the mech's pilot's crawler's game can view
 */
export async function canViewMech(mech: MechRow): Promise<boolean> {
  if (!mech.private) return true

  const userId = await getCurrentUserId()
  if (!userId) return false

  if (mech.user_id === userId) return true

  if (!mech.pilot_id) return false

  const { data: pilot, error: pilotError } = await supabase
    .from('pilots')
    .select('crawler_id')
    .eq('id', mech.pilot_id)
    .maybeSingle()

  if (pilotError) throw pilotError
  if (!pilot || !pilot.crawler_id) return false

  const { data: crawler, error: crawlerError } = await supabase
    .from('crawlers')
    .select('game_id')
    .eq('id', pilot.crawler_id)
    .maybeSingle()

  if (crawlerError) throw crawlerError
  if (!crawler || !crawler.game_id) return false

  return isUserInGame(userId, crawler.game_id)
}

/**
 * Assert that user can view a game, throw PermissionError if not
 */
export async function assertCanViewGame(game: GameRow): Promise<void> {
  const canView = await canViewGame(game)
  if (!canView) {
    throw new PermissionError('This game is private and you do not have access to it')
  }
}

/**
 * Assert that user can view a crawler, throw PermissionError if not
 */
export async function assertCanViewCrawler(crawler: CrawlerRow): Promise<void> {
  const canView = await canViewCrawler(crawler)
  if (!canView) {
    throw new PermissionError('This crawler is private and you do not have access to it')
  }
}

/**
 * Assert that user can view a pilot, throw PermissionError if not
 */
export async function assertCanViewPilot(pilot: PilotRow): Promise<void> {
  const canView = await canViewPilot(pilot)
  if (!canView) {
    throw new PermissionError('This pilot is private and you do not have access to it')
  }
}

/**
 * Assert that user can view a mech, throw PermissionError if not
 */
export async function assertCanViewMech(mech: MechRow): Promise<void> {
  const canView = await canViewMech(mech)
  if (!canView) {
    throw new PermissionError('This mech is private and you do not have access to it')
  }
}
