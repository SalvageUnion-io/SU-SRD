import { formatActionType } from 'salvageunion-reference'

/**
 * The action type as its chip reads it, in the book's words
 * (`ACTION_TYPE_LABELS`): "Turn Action", "Reaction", or the split
 * "Turn Action (Mech)", "Short Action (Pilot)" (Core Book pp.248-249).
 */
export function actionTypeStamps(
  actionType: string | undefined,
  mechActionType: string | undefined
): string[] {
  if (!actionType) return []
  const own = formatActionType(actionType)
  return mechActionType ? [`${formatActionType(mechActionType)} (Mech)`, `${own} (Pilot)`] : [own]
}
