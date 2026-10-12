/** The action type as its head stamp reads it: "Turn", or the split "Turn (Mech)". */
export function actionTypeStamps(
  actionType: string | undefined,
  mechActionType: string | undefined
): string[] {
  if (!actionType) return []
  return mechActionType ? [`${mechActionType} (Mech)`, `${actionType} (Pilot)`] : [actionType]
}
