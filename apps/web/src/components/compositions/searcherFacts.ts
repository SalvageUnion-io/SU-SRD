/**
 * What a picker row says beside its Mini on a wide screen (r4 E6): Salvage
 * Value, Action, Range and Damage, the facts the guided builder's table lists,
 * so six weapons compare without six opens. Read off the entity's display
 * model (`toEntityModel`), as its card reads them.
 */

import type { EntityModel, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { compositionsCopy } from '../../messages/components-compositions'
import type { PoolEntity } from './entitySearcherTypes'

const models = new WeakMap<object, EntityModel | null>()

function modelOf(entity: PoolEntity): EntityModel | null {
  const known = models.get(entity)
  if (known !== undefined) return known
  let built: EntityModel | null = null
  try {
    built = toEntityModel(entity as unknown as RefMetaEntity)
  } catch {
    // A caller's own entity the model cannot read says nothing extra.
  }
  models.set(entity, built)
  return built
}

function fact(model: EntityModel, key: string): string {
  const found = model.facts.find((entry) => entry.key === key)
  if (found) return String(found.value)
  // A custom weapon prints its range and damage as keyword values.
  const keyword = model.traits.find((trait) => trait.name.toLowerCase() === key)
  return keyword?.param ? String(keyword.param) : ''
}

/** `always`: shown at every width (a chassis's slots, what it is chosen by). */
export type RowFact = { key: string; label: string; value: string; always?: boolean }

/** The row's facts, each only where the entity has it. */
export function rowFacts(entity: PoolEntity): RowFact[] {
  const facts: RowFact[] = []
  // A chassis is chosen by its slots (r4 E17): on every row, a phone's too.
  const { systemSlots, moduleSlots } = entity as { systemSlots?: unknown; moduleSlots?: unknown }
  if (typeof systemSlots === 'number' && typeof moduleSlots === 'number') {
    return [
      { key: 'sys', label: compositionsCopy('rowSys'), value: String(systemSlots), always: true },
      { key: 'mod', label: compositionsCopy('rowMod'), value: String(moduleSlots), always: true },
    ]
  }
  const sv = (entity as { salvageValue?: unknown }).salvageValue
  if (typeof sv === 'number') {
    facts.push({ key: 'sv', label: compositionsCopy('rowSv'), value: String(sv) })
  }
  const model = modelOf(entity)
  if (!model) return facts
  if (model.actionType) {
    facts.push({ key: 'action', label: compositionsCopy('rowAction'), value: model.actionType })
  }
  const range = fact(model, 'range')
  if (range) facts.push({ key: 'range', label: compositionsCopy('rowRange'), value: range })
  const damage = fact(model, 'damage')
  if (damage) facts.push({ key: 'damage', label: compositionsCopy('rowDamage'), value: damage })
  return facts
}

/**
 * Whether the entity is NAMED by the query (r4 E5): every word typed is in
 * its name. A row matched only on its rules text is not.
 */
export function namedBy(entity: { name: string }, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const name = entity.name.toLowerCase()
  return words.length > 0 && words.every((word) => name.includes(word))
}
