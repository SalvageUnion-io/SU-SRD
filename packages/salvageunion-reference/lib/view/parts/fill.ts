/**
 * An entity's TONE, as the theme token key the UI paints (`--color-<key>`),
 * and which FILL its header takes. The colours themselves stay in
 * `theme.css`, since this package knows no CSS.
 */

import { getBlackMarket, getTechLevel, getTechLevelNumber } from '../../entityFields'
import { isAbility } from '../../entityGuards'
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index'
import { classKind, isDoEntity, isHybridTree, schemaDomain } from './kind'

/** The rules-blue token (`--color-wk-line`): the Rules · Salvaging chapter's band. */
const RULES_BLUE = 'wk-line'

/**
 * A guide's tone token, or `undefined` for every other entity. A creation
 * guide wears the colour of what it creates (R44): Create a Pilot
 * pilot orange, Create a Mech mech green, Create a Crawler crawler pink.
 * Heat wears its own red and Crawler Downtime the crawler's pink; every
 * other guide rules blue, as
 * its page's band is. A guide is the record with
 * a `guideType`.
 */
const CREATION_TONE: Readonly<Record<string, string>> = {
  'character-creation': 'pilot',
  'mech-creation': 'mech',
  'crawler-creation': 'crawler',
}

export function guideTone(entity: RefMetaEntity): string | undefined {
  if (entity == null || typeof entity !== 'object' || !('guideType' in entity)) return undefined
  if (typeof entity.guideType !== 'string') return undefined
  const creation = CREATION_TONE[entity.guideType]
  if (creation) return creation
  if ('name' in entity && entity.name === 'Heat') return 'heat'
  if ('name' in entity && entity.name === 'Crawler Downtime') return 'crawler'
  return RULES_BLUE
}

/** The numeric tech-level ramp: TL1–6 own a band each. */
function techLevelTone(level: number | undefined): string | undefined {
  return level !== undefined && level >= 1 && level <= 6 ? `tl-${level}` : undefined
}

/** Tier tones (over the book's spreads): Core =
 * pilot orange, Advanced and Hybrid = rust (`tier-hybrid`), Legendary =
 * crawler pink. The abilities index and an ability's show page both read
 * this, so they cannot disagree; a tree requirement wears its tree's. */
function tierTone(tier: { legendary: boolean; advanced: boolean }): string {
  if (tier.legendary) return 'crawler'
  return tier.advanced ? 'tier-hybrid' : 'pilot'
}

function abilityTierTone(entity: RefMetaEntity): string {
  const tree = 'tree' in entity ? String(entity.tree) : ''
  return tierTone({
    legendary:
      ('level' in entity && String(entity.level).toUpperCase() === 'L') ||
      tree.includes('Legendary'),
    advanced: isHybridTree(tree) || tree.includes('Advanced'),
  })
}

function treeRequirementTone(entity: RefMetaEntity): string {
  const name = 'name' in entity ? String(entity.name).toLowerCase() : ''
  return tierTone({
    legendary: name.includes('legendary'),
    advanced: name.includes('hybrid') || name.includes('advanced'),
  })
}

const SCHEMA_TONE: Partial<Record<RefEnumSchemaName, string>> = {
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
  // Rules entries wear rules blue, as their pages' bands do.
  keywords: RULES_BLUE,
  distances: RULES_BLUE,
  traits: RULES_BLUE,
  guides: RULES_BLUE,
  'roll-tables': RULES_BLUE,
  sources: RULES_BLUE,
  classes: 'pilot',
}

/**
 * The tone token. An ACTION is `ink`: it has no tone of its own. A guide and
 * every rules entry (keyword, trait, distance, source, roll table) wear rules
 * blue (`wk-line`); gear rides the tech-level ramp (`tl-1`…`tl-6`, `tl-b`,
 * `tl-n`) — systems and modules included, as the book heads each entry and
 * index row in its tech level's blue under the green Mech Workshop band
 * (Core Book pp. 162–164, 188–190); black-market goods are `ink-2`; abilities
 * take their tier tone; everything else its schema's hue.
 */
export function entityTone(
  schemaName: RefEnumSchemaName | 'actions',
  entity: RefMetaEntity
): string {
  if (schemaName === 'actions') return 'ink'
  const guide = guideTone(entity)
  if (guide) return guide
  if (schemaDomain(schemaName) === 'gear') {
    const level = getTechLevel(entity)
    const tone = level === 'B' ? 'tl-b' : level === 'N' ? 'tl-n' : techLevelTone(level)
    if (tone) return tone
  }
  // A bio-chassis wears the bio gear's mutant green, not chassis green.
  if (schemaName === 'chassis' && getTechLevel(entity) === 'B') return 'tl-b'
  if (getBlackMarket(entity) === true) return 'ink-2'
  // A Hybrid Class wears the tier rust its Advanced and Hybrid abilities wear,
  // apart from the Core classes' orange (R44).
  if (schemaName === 'classes' && classKind(entity) === 'HYBRID') return 'tier-hybrid'
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
 * except an ability's Compact, which wears its tier tone (Core orange, Advanced
 * and Hybrid rust, Legendary pink) wherever abilities are listed.
 */
export function headerFill(entity: RefMetaEntity, form: 'row' | 'card' | 'page'): HeaderFill {
  if (form === 'row' && isAbility(entity)) return 'tone'
  return isDoEntity(entity) ? 'ink' : 'tone'
}
