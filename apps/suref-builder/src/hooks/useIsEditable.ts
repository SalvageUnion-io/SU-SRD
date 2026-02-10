/**
 * Hook to determine if an entity is editable by the current user
 *
 * An entity is editable if:
 * - It's a local (cache-only) entity, OR
 * - The current user owns the entity
 *
 * @param entity - Entity with user_id property, or undefined
 * @param isLocal - Whether the entity is local (cache-only)
 * @returns Whether the entity is editable
 *
 * @example
 * ```tsx
 * const { pilot, isLocal } = useHydratedPilot(pilotId)
 * const isEditable = useIsEditable(pilot, isLocal)
 * ```
 */
import { useCurrentUser } from './useCurrentUser'
import { isOwner } from '../lib/permissions'

export function useIsEditable(entity: { user_id: string } | undefined, isLocal: boolean): boolean {
  const { userId } = useCurrentUser()
  return isLocal || (entity ? isOwner(entity.user_id, userId) : false)
}
