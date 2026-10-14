/**
 * A nested entry as an index row: the bot's Read rows for a card's systems and
 * modules (`apps/discord-bot/src/lookupCard.ts`), drawn as an action's row is.
 */

import { SalvageUnionReference } from '../index'
import type { SURefMetaEntity } from '../schemas/index'
import { actionTypeLine, discordRefUrl, link, traitTags } from './discordCard'
import { costChip, factChips } from './discordChips'
import { splitStatLine } from './parts/facts'
import { toEntityModel } from './toEntityModel'
import type { EntityRef } from './types'

/** The stats an index row shows: never the build cells (slots, tech level, value). */
const ROW_HIDDEN_FACTS = new Set(['tech-level', 'ref-stat-slotsRequired', 'ref-stat-salvageValue'])

/**
 * A nested entity as an index row, the shape an action's row takes: its name
 * (a link to its page), then a `-#` line of its label-first chips in the stat
 * order (its stats, its action type and facets), then its traits, the cost
 * closing the last line (E17). Null for an entry that is not in the dataset (a
 * synthetic record).
 */
export function discordRowSummary(ref: EntityRef): string | null {
  if (ref.synthetic) return null
  const record = SalvageUnionReference.get(ref.schemaName, ref.id)
  if (!record) return null
  const model = toEntityModel(record as SURefMetaEntity)
  const { stats, action } = splitStatLine(
    model.facts.filter((fact) => !ROW_HIDDEN_FACTS.has(fact.key))
  )
  const meta = [...factChips(stats), actionTypeLine(model), ...factChips(action)].filter(Boolean)
  const lines = [`**${link(ref.pattern ?? ref.name, discordRefUrl(ref))}**`]
  if (meta.length > 0) lines.push(`-# ${meta.join(' · ')}`)
  if (model.traits.length > 0) lines.push(traitTags(model.traits))
  const cost = costChip(model)
  if (cost) {
    const last = lines.length - 1
    lines[last] = last === 0 ? `${lines[last]}\n-# ${cost}` : `${lines[last]} · ${cost}`
  }
  return lines.join('\n')
}
