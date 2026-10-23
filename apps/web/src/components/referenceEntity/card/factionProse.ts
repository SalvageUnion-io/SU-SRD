/**
 * A faction's book sections as content blocks: GOALS, ASSETS and WEAKNESSES,
 * then its LANCE FORMATION (We Were Here First! p.14), after its own prose.
 * The data keeps them as fields; the card prints them as the book does.
 */

import type { RefObjectContentBlock } from 'salvageunion-reference'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'

type FormationEntry = { chassis: string; pattern?: string; quantity?: number }

type FactionFields = {
  goals?: string
  assets?: string
  weaknesses?: string
  formation?: FormationEntry[]
}

/** Each section's field and head, in the book's order. */
const SECTIONS = [
  { field: 'goals', head: () => referenceEntityCopy('goals') },
  { field: 'assets', head: () => referenceEntityCopy('assets') },
  { field: 'weaknesses', head: () => referenceEntityCopy('weaknesses') },
] as const

function formationLine(entry: FormationEntry): string {
  const unit = entry.pattern
    ? referenceEntityCopy('formationPattern', { pattern: entry.pattern, chassis: entry.chassis })
    : entry.chassis
  return entry.quantity && entry.quantity > 1
    ? referenceEntityCopy('formationCount', { quantity: entry.quantity, chassis: unit })
    : unit
}

/** The blocks a faction's fields print as, or none for any other entity. */
export function factionSectionBlocks(entity: object): RefObjectContentBlock[] {
  const faction = entity as FactionFields
  const blocks: RefObjectContentBlock[] = []
  for (const { field, head } of SECTIONS) {
    const text = faction[field]
    if (typeof text !== 'string' || text.length === 0) continue
    blocks.push({ type: 'heading', level: 3, value: head() })
    blocks.push({ type: 'paragraph', value: text })
  }
  if (Array.isArray(faction.formation) && faction.formation.length > 0) {
    blocks.push({ type: 'heading', level: 3, value: referenceEntityCopy('lanceFormation') })
    for (const entry of faction.formation) {
      blocks.push({ type: 'list-item', value: formationLine(entry) })
    }
  }
  return blocks
}
