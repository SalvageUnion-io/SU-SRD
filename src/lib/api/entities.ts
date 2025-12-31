import { supabase } from '../supabase'
import type { ValidTable } from '../../types/common'
import type { Tables } from '../../types/database-generated.types'
import {
  assertCanViewGame,
  assertCanViewCrawler,
  assertCanViewPilot,
  assertCanViewMech,
} from '../permissions'

/**
 * Helper to safely cast database results to expected type.
 * This is necessary because Supabase returns a union of all possible table types,
 * but we know the specific table type based on the table parameter.
 */
function castDatabaseResult<T>(data: unknown): T {
  return data as T
}

/**
 * Fetch a single entity by ID from any table
 * Checks permissions before returning
 *
 * @template T - The expected row type (should match Tables<tableName>)
 */
export async function fetchEntity<T>(table: ValidTable, id: string): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id' as never, id)
    .single()

  if (error) throw error
  if (!data) throw new Error(`${table} not found`)

  const entity = castDatabaseResult<T>(data)

  if (table === 'games') {
    await assertCanViewGame(entity as unknown as Tables<'games'>)
  } else if (table === 'crawlers') {
    await assertCanViewCrawler(entity as unknown as Tables<'crawlers'>)
  } else if (table === 'pilots') {
    await assertCanViewPilot(entity as unknown as Tables<'pilots'>)
  } else if (table === 'mechs') {
    await assertCanViewMech(entity as unknown as Tables<'mechs'>)
  }

  return entity
}

/**
 * Fetch all entities for a user from any table
 *
 * @template T - The expected row type (should match Tables<tableName>)
 */
export async function fetchUserEntities<T extends { id: string }>(
  table: ValidTable,
  userId: string,
  options?: {
    orderBy?: string
    orderAscending?: boolean
    filterField?: string
    filterValue?: string
  }
): Promise<T[]> {
  let query = supabase
    .from(table)
    .select('*')
    .eq('user_id' as never, userId)

  if (options?.filterField && options?.filterValue) {
    query = query.eq(options.filterField as never, options.filterValue)
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy as never, {
      ascending: options.orderAscending ?? false,
    })
  }

  const { data, error } = await query

  if (error) throw error
  return castDatabaseResult<T[]>(data || [])
}

/**
 * Update an entity in any table
 */
export async function updateEntity<T>(
  table: ValidTable,
  id: string,
  updates: Partial<T>
): Promise<void> {
  const { error } = await supabase.from(table).update(updates).eq('id', id)

  if (error) throw error
}

/**
 * Create an entity in any table
 */
export async function createEntity<T>(table: ValidTable, data: T): Promise<T> {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data as never)
    .select()
    .single()

  if (error) throw error
  if (!result) throw new Error(`Failed to create ${table}`)
  return result as T
}

/**
 * Delete an entity from any table
 */
export async function deleteEntity(table: ValidTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)

  if (error) throw error
}
