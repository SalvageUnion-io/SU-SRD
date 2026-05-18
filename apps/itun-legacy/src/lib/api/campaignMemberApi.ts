import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { AppError } from '../errors'

/** Promote a player to mediator (caller must be a mediator). */
export async function promoteMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_members')
    .update({ role: 'mediator' })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)

  if (error) handleSupabaseError(error)
}

/** Demote yourself from mediator to player. */
export async function selfDemote(campaignId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('AUTH_REQUIRED', 'Not authenticated', 401)

  const { error } = await supabase
    .from('campaign_members')
    .update({ role: 'player' })
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)

  if (error) handleSupabaseError(error)
}

/** Remove a member from a campaign (caller must be a mediator). */
export async function uninviteMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)

  if (error) handleSupabaseError(error)
}
