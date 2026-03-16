/**
 * Zod enum schemas from enums.schema.json
 */

import { z } from 'zod'

/**
 * The source book or expansion for this content
 */
export const SourceSchema = z
  .enum([
    'Salvage Union Workshop Manual',
    'Mech Monday',
    'We Were Here First!',
    'Rainmaker',
    'False Flag',
  ])
  .describe('The source book or expansion for this content')

/**
 * Type of content block for rendering structured text
 */
export const ContentTypeSchema = z
  .enum(['paragraph', 'heading', 'list-item', 'label', 'datavalues', 'hint', 'flavor'])
  .describe('Type of content block for rendering structured text')

/**
 * Individual range value
 */
export const RangeItemSchema = z
  .enum(['Close', 'Medium', 'Long', 'Far'])
  .describe('Individual range band value')

/**
 * Range bands for abilities and weapons
 */
export const RangeSchema = z
  .array(RangeItemSchema)
  .min(1)
  .describe('Range bands for abilities and weapons')

/**
 * Type of action required to use an ability
 */
export const ActionTypeSchema = z
  .enum(['Passive', 'Free', 'Reaction', 'Turn', 'Short', 'Long', 'DownTime'])
  .describe('Type of action required to use an ability')

/**
 * Type of damage
 */
export const DamageTypeSchema = z.enum(['HP', 'SP']).describe('Type of damage (HP or SP)')

/**
 * Type of advanced class
 */
export const ClassTypeSchema = z
  .enum(['Advanced', 'Hybrid'])
  .describe('Type of advanced class (Advanced or Hybrid)')

/**
 * Ability tree name
 */
export const TreeSchema = z
  .enum([
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
    'Gladiatorial Combat',
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
  .describe('Ability tree name for pilot class progression')

/**
 * Name of the schema
 */
export const SchemaNameSchema = z
  .enum([
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
    'sources',
    'squads',
    'tech-levels',
    'systems',
    'traits',
    'vehicles',
  ])
  .describe('Name of the entity schema collection')
