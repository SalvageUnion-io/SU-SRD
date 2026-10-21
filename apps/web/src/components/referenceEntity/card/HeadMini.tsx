import type { EntityInstance, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { MiniSlots } from '../../entity/forms/Mini'
import { Mini } from '../../entity/forms/Mini'

/**
 * The head extent as the entity form (the adapter): an entity drawn as its
 * head alone is a Mini (EDL N2), whatever its size, given the slots this
 * card resolved from its props. A Compact or Card always has its body. A stamp
 * the card would wear (a book starting pattern's) leads the name, as a
 * unit's note does.
 */
export function HeadMini({
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
  slots: MiniSlots
}) {
  const model = toEntityModel(entity, undefined, { pattern })
  const noted = note ? { ...model, kind: { ...model.kind, note } } : model
  return <Mini model={noted} context="browse" instance={instance} slots={slots} />
}
