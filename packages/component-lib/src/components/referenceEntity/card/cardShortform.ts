import type { TokenFact } from '../../../entity/forms/Token'

/** An NPC's shortform stat: its hit points (or structure points), as `HP 9`. */
function npcHitPointsTail(entity: object): TokenFact | undefined {
  if (!('schemaName' in entity) || entity.schemaName !== 'npcs') return undefined
  if (!('hitPoints' in entity) || typeof entity.hitPoints !== 'number') return undefined
  return {
    label: 'damageType' in entity && entity.damageType === 'SP' ? 'SP' : 'HP',
    value: String(entity.hitPoints),
  }
}

/** The shortform's tail: an ability's level, a tech level, an NPC's hit points or a classification. */
export function shortformTail(
  numeral: string | undefined,
  techLevel: number | 'B' | 'N' | undefined,
  entity: object,
  axisMarker: TokenFact | undefined
): TokenFact | undefined {
  if (numeral) return { label: 'LVL', value: numeral }
  if (techLevel != null) return { label: 'TL', value: String(techLevel) }
  return npcHitPointsTail(entity) ?? axisMarker
}
