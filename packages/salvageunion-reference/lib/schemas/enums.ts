/**
 * Zod enum schemas from enums.schema.json
 */

import { z } from 'zod'

/**
 * The source book or expansion for this content
 */
export const SourceSchema = z.enum([
  'Salvage Union Workshop Manual',
  'Mech Monday',
  'We Were Here First!',
  'Rainmaker',
  'False Flag',
])

/**
 * Type of content block for rendering structured text
 */
export const ContentTypeSchema = z.enum([
  'paragraph',
  'heading',
  'list-item',
  'label',
  'datavalues',
  'hint',
  'flavor',
])

/**
 * Individual range value
 */
export const RangeItemSchema = z.enum(['Close', 'Medium', 'Long', 'Far'])

/**
 * Range bands for abilities and weapons
 */
export const RangeSchema = z.array(RangeItemSchema).min(1)

/**
 * Type of action required to use an ability
 */
export const ActionTypeSchema = z.enum([
  'Passive',
  'Free',
  'Reaction',
  'Turn',
  'Short',
  'Long',
  'DownTime',
])

/**
 * Type of damage
 */
export const DamageTypeSchema = z.enum(['HP', 'SP'])

/**
 * Type of advanced class
 */
export const ClassTypeSchema = z.enum(['Advanced', 'Hybrid'])

/**
 * Ability tree name
 */
export const TreeSchema = z.enum([
  'Advanced Engineer',
  'Advanced Hacking',
  'Advanced Hauler',
  'Advanced Scout',
  'Advanced Soldier',
  'Augmentation',
  'Cyborg',
  'Electronics',
  'Fabricator',
  'Forging',
  'Generic',
  'Gladitorial Combat',
  'Hacking',
  'Leadership',
  'Legendary Cyborg',
  'Legendary Engineer',
  'Legendary Fabricator',
  'Legendary Hacker',
  'Legendary Hauler',
  'Legendary Ranger',
  'Legendary Scout',
  'Legendary Smuggler',
  'Legendary Soldier',
  'Legendary Union Rep',
  'Mech-Tech',
  'Mechanical Knowledge',
  'Ranger',
  'Recon',
  'Salvaging',
  'Sleuth',
  'Smuggler',
  'Sniper',
  'Survivalist',
  'Tactical Warfare',
  'Trading',
  'Union Rep',
])

/**
 * Name of the schema
 */
export const SchemaNameSchema = z.enum([
  'abilities',
  'ability-tree-requirements',
  'bio-titans',
  'chassis',
  'classes',
  'crawler-bays',
  'crawler-tech-levels',
  'crawlers',
  'creatures',
  'distances',
  'drones',
  'equipment',
  'guides',
  'keywords',
  'factions',
  'meld',
  'modules',
  'npcs',
  'roll-tables',
  'squads',
  'systems',
  'traits',
  'vehicles',
])
