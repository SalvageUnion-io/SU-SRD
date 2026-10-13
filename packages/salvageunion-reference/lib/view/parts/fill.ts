/**
 * An entity's TONE, as the theme token key the UI paints (`--color-<key>`),
 * and which FILL its header takes. The colours themselves stay in
 * `theme.css`, since this package knows no CSS.
 */

import { getBlackMarket, getTechLevel, getTechLevelNumber } from '../../entityFields'
import { isAbility } from '../../entityGuards'
import type { SURefEnumSchemaName, SURefMetaEntity } from '../../schemas/index'
import { isDoEntity, isHybridTree, schemaDomain } from './kind'

/** A guide's authored `guideTone` name → the token it paints. */
const GUIDE_TONE: Record<string, string> = {
  pilot: 'pilot',
  mech: 'mech',
  crawler: 'crawler',
  salvage: 'guide-salvage',
  hazard: 'guide-hazard',
  ink: 'ink',
}

/** A guide's own authored tone token, or `undefined` for every other entity. */
export function guideTone(entity: SURefMetaEntity): string | undefined {
  if (entity == null || typeof entity !== 'object' || !('guideTone' in entity)) return undefined
  const tone = entity.guideTone
  return typeof tone === 'string' ? GUIDE_TONE[tone] : undefined
}

/** The numeric tech-level ramp: TL1–6 own a band each. */
function techLevelTone(level: number | undefined): string | undefined {
  return level !== undefined && level >= 1 && level <= 6 ? `tl-${level}` : undefined
}

/** Ability tier tones: Core = pilot orange, Advanced and Hybrid = the darker
 * rust (`tier-advanced`), Legendary = purple (`tier-legendary`). */
function abilityTierTone(entity: SURefMetaEntity): string {
  const isLegendary =
    ('level' in entity && String(entity.level).toUpperCase() === 'L') ||
    ('tree' in entity && String(entity.tree).includes('Legendary'))
  if (isLegendary) return 'tier-legendary'
  const tree = 'tree' in entity ? String(entity.tree) : ''
  return tree.includes('Advanced') || isHybridTree(tree) ? 'tier-advanced' : 'pilot'
}

function treeRequirementTone(entity: SURefMetaEntity): string {
  const name = 'name' in entity ? String(entity.name).toLowerCase() : ''
  if (name.includes('legendary')) return 'tier-legendary'
  if (name.includes('advanced') || name.includes('hybrid')) return 'tier-advanced'
  return 'pilot'
}

const SCHEMA_TONE: Partial<Record<SURefEnumSchemaName, string>> = {
  chassis: 'mech',
  crawlers: 'crawler',
  'crawler-tech-levels': 'crawler',
  'crawler-bays': 'crawler',
  creatures: 'adversary',
  'bio-titans': 'adversary',
  factions: 'adversary',
  npcs: 'adversary',
  meld: 'adversary',
  squads: 'adversary',
  keywords: 'ink-2',
  distances: 'ink-2',
  traits: 'ink-2',
  guides: 'ink-2',
  'roll-tables': 'ink-2',
  sources: 'ink-2',
  classes: 'pilot',
}

/**
 * The tone token. An ACTION is `ink`: it has no tone of its own. A guide wears
 * its authored tone; gear rides the tech-level ramp (`tl-1`…`tl-6`, `tl-b`,
 * `tl-n`) — systems and modules included, as the book heads each entry and
 * index row in its tech level's blue under the green Mech Workshop band
 * (Core Book pp. 162–164, 188–190); black-market goods are `ink-2`; abilities
 * take their tier tone; everything else its schema's hue.
 */
export function entityTone(
  schemaName: SURefEnumSchemaName | 'actions',
  entity: SURefMetaEntity
): string {
  if (schemaName === 'actions') return 'ink'
  const authored = guideTone(entity)
  if (authored) return authored
  if (schemaDomain(schemaName) === 'gear') {
    const level = getTechLevel(entity)
    const tone = level === 'B' ? 'tl-b' : level === 'N' ? 'tl-n' : techLevelTone(level)
    if (tone) return tone
  }
  if (getBlackMarket(entity) === true) return 'ink-2'
  const bySchema = SCHEMA_TONE[schemaName]
  if (bySchema) return bySchema
  if (schemaName === 'abilities') return abilityTierTone(entity)
  if (schemaName === 'ability-tree-requirements') return treeRequirementTone(entity)
  return techLevelTone(getTechLevelNumber(entity)) ?? 'pilot'
}

/** The header's two fills (ruleset §5): TONE for things you have, INK for
 * things you do. */
export type HeaderFill = 'tone' | 'ink'

/**
 * Which fill a header takes in a form (E12): things you do are the ink banner,
 * except an ability's Row, which wears its tier tone (Core orange, Advanced
 * rust, Legendary purple) wherever abilities are listed.
 */
export function headerFill(entity: SURefMetaEntity, form: 'row' | 'card' | 'page'): HeaderFill {
  if (form === 'row' && isAbility(entity)) return 'tone'
  return isDoEntity(entity) ? 'ink' : 'tone'
}
