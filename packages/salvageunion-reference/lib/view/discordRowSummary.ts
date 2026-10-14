/**
 * A nested entry as an index row: the bot's Read rows for a card's systems and
 * modules (`apps/discord-bot/src/lookupCard.ts`), drawn as an action's row is.
 */

import { SalvageUnionReference } from '../index'
import type { SURefMetaEntity } from '../schemas/index'
import { actionTypeLine, discordRefUrl, link, traitTags } from './discordCard'
import { costChip, factChips } from './discordChips'
import { toEntityModel } from './toEntityModel'
import type { EntityRef } from './types'

/** The stats an index row shows: never the build cells (slots, tech level, value). */
const ROW_HIDDEN_FACTS = new Set(['tech-level', 'ref-stat-slotsRequired', 'ref-stat-salvageValue'])

/**
 * A nested entity as an index row, the shape an action's row takes: its name
 * (a link to its page), a `-#` line of its action type, its label-first
 * chips and its cost last (E17), then its traits. Null for an entry that is
 * not in the dataset (a synthetic record).
 */
export function discordRowSummary(ref: EntityRef): string | null {
  if (ref.synthetic) return null
  const record = SalvageUnionReference.get(ref.schemaName, ref.id)
  if (!record) return null
  const model = toEntityModel(record as SURefMetaEntity)
  const meta = [
    actionTypeLine(model),
    ...factChips(model.facts.filter((fact) => !ROW_HIDDEN_FACTS.has(fact.key))),
    // The cost closes the line, as on every card (E17).
    costChip(model),
  ].filter(Boolean)
  const lines = [`**${link(ref.pattern ?? ref.name, discordRefUrl(ref))}**`]
  if (meta.length > 0) lines.push(`-# ${meta.join(' · ')}`)
  if (model.traits.length > 0) lines.push(traitTags(model.traits))
  return lines.join('\n')
}
