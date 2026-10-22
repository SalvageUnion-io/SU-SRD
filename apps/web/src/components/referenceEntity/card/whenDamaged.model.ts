/**
 * The When Damaged block's model (hard rule R18): the one place a crawler
 * bay's `damagedEffect` field is read (the `entity-nesting` rule set's
 * `named-block` holds it). The card's prose filter, the card and the live
 * sheet's bay all take the text from here, and draw it through `WhenDamaged`.
 */
export function damagedEffectOf(entity: object): string | undefined {
  const effect = (entity as { damagedEffect?: unknown }).damagedEffect
  return typeof effect === 'string' && effect.trim() !== '' ? effect : undefined
}
