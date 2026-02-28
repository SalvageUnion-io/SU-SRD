import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { Json } from '../../types/database-generated.types'

type ChangeLogTarget = 'pilot' | 'mech' | 'crawler' | 'entity_ref' | 'player_choice'

type LogParams = {
  targetId: string
  targetType: ChangeLogTarget
  action: 'create' | 'update' | 'delete'
  field?: string
  oldValue?: unknown
  newValue?: unknown
  description: string
  sessionId?: string
  reversible?: boolean
  gameId?: string
}

export type ChangeLogEntry = {
  id: string
  user_id: string
  target_id: string
  target_type: string
  action: string
  field: string | null
  game_id: string | null
  old_value: Json | null
  new_value: Json | null
  description: string | null
  session_id: string | null
  reversible: boolean
  created_at: string
}

const PAGE_SIZE = 50

export const changeLogApi = {
  log: async (userId: string, params: LogParams): Promise<void> => {
    const { error } = await supabase.from('change_log').insert({
      user_id: userId,
      target_id: params.targetId,
      target_type: params.targetType,
      action: params.action,
      field: params.field ?? null,
      old_value: (params.oldValue as Json) ?? null,
      new_value: (params.newValue as Json) ?? null,
      description: params.description,
      session_id: params.sessionId ?? null,
      reversible: params.reversible ?? false,
      game_id: params.gameId ?? null,
    })

    if (error) handleSupabaseError(error)
  },

  listByTarget: async (targetId: string, targetType: string): Promise<ChangeLogEntry[]> => {
    const { data, error } = await supabase
      .from('change_log')
      .select(
        'id,action,created_at,description,field,new_value,old_value,reversible,session_id,target_id,target_type,user_id'
      )
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .order('created_at', { ascending: false })

    if (error) handleSupabaseError(error)
    return (data ?? []) as ChangeLogEntry[]
  },

  listByGame: async (gameId: string, opts?: { before?: string }): Promise<ChangeLogEntry[]> => {
    let query = supabase
      .from('change_log')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (opts?.before) {
      query = query.lt('created_at', opts.before)
    }

    const { data, error } = await query

    if (error) handleSupabaseError(error)
    return (data ?? []) as ChangeLogEntry[]
  },
}
