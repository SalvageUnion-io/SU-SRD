export type PatternAccess = { canView: true; canEdit: boolean } | { canView: false }

export function getPatternAccess(
  pattern: { user_id: string; visible: boolean },
  userId: string | undefined
): PatternAccess {
  if (userId && pattern.user_id === userId) {
    return { canView: true, canEdit: true }
  }

  if (pattern.visible) {
    return { canView: true, canEdit: false }
  }

  return { canView: false }
}
