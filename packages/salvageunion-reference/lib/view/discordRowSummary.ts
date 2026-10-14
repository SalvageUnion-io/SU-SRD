/**
 * A nested entry as an index row: the bot's Read rows for a card's systems and
 * modules (`apps/discord-bot/src/lookupCard.ts`), drawn as an action's row is.
 */

import { SalvageUnionReference } from '../index'
import type { SURefMetaEntity } from '../schemas/index'
import { actionTypeLine, discordRefUrl, factCells, link, traitTags } from './discordCard'
import { toEntityModel } from './toEntityModel'
import type { EntityRef } from './types'

/** The stats an index row shows: never the build cells (slots, tech level, value). */
const ROW_HIDDEN_FACTS = new Set(['tech-level', 'ref-stat-slotsRequired', 'ref-stat-salvageValue'])

/**
 * A nested entity as an index row, the shape an action's row takes: its name
 * (a link to its page), a `-#` line of its action type, cost, range and
 * damage, then its traits. Null for an entry that is not in the dataset (a
 * synthetic record).
 */
export function discordRowSummary(ref: EntityRef): string | null {
  if (ref.synthetic) return null
  const record = SalvageUnionReference.get(ref.schemaName, ref.id)
  if (!record) return null
  const model = toEntityModel(record as SURefMetaEntity)
  const meta = [
    actionTypeLine(model),
    model.cost ? `\`${model.cost}\`` : undefined,
    ...factCells(
      model.facts.filter((fact) => !ROW_HIDDEN_FACTS.has(fact.key)),
      99
    ),
  ].filter(Boolean)
  const lines = [`**${link(ref.pattern ?? ref.name, discordRefUrl(ref))}**`]
  if (meta.length > 0) lines.push(`-# ${meta.join(' · ')}`)
  if (model.traits.length > 0) lines.push(traitTags(model.traits))
  return lines.join('\n')
}
