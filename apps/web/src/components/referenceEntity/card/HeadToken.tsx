import type { EntityInstance, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { TokenSlots } from '../../entity/forms/Token'
import { Token } from '../../entity/forms/Token'

/**
 * The head extent as the entity form (the adapter): an entity drawn as its
 * head alone is a TOKEN (EDL N2), whatever its size, given the slots this
 * card resolved from its props. A Row or Card always has its body. A stamp
 * the card would wear (a book starting pattern's) leads the name, as a
 * unit's note does.
 */
export function HeadToken({
  entity,
  pattern,
  instance,
  note,
  slots,
}: {
  entity: RefMetaEntity
  pattern: RefObjectAnyPattern | undefined
  instance: EntityInstance
  note: string | undefined
  slots: TokenSlots
}) {
  const model = toEntityModel(entity, undefined, { pattern })
  const noted = note ? { ...model, kind: { ...model.kind, note } } : model
  // A live pennant is the Dashboard's, the play surface (C4); elsewhere it browses.
  const context = slots.pennant ? 'play' : 'browse'
  return <Token model={noted} context={context} instance={instance} slots={slots} />
}
