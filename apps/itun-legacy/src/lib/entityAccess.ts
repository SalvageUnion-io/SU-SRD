export type EntityAccess = { canView: true; canEdit: boolean } | { canView: false }

export function getEntityAccess(
  entity: { user_id: string; visible: boolean },
  userId: string | undefined
): EntityAccess {
  if (userId && entity.user_id === userId) {
    return { canView: true, canEdit: true }
  }

  if (entity.visible) {
    return { canView: true, canEdit: false }
  }

  return { canView: false }
}
