/**
 * Shared mapping from schema IDs to singular type names
 * Used by both generateSchemaTypes.ts and generateUtilities.ts
 * to ensure consistency across generated code
 */
export const SCHEMA_NAME_MAP: Record<string, string> = {
  abilities: 'Ability',
  'ability-tree-requirements': 'AbilityTreeRequirement',
  'bio-titans': 'BioTitan',
  chassis: 'Chassis',
  classes: 'Class',
  'crawler-bays': 'CrawlerBay',
  'crawler-tech-levels': 'CrawlerTechLevel',
  crawlers: 'Crawler',
  creatures: 'Creature',
  distances: 'Distance',
  drones: 'Drone',
  equipment: 'Equipment',
  keywords: 'Keyword',
  factions: 'Faction',
  meld: 'Meld',
  modules: 'Module',
  npcs: 'NPC',
  'roll-tables': 'RollTable',
  squads: 'Squad',
  systems: 'System',
  traits: 'Trait',
  vehicles: 'Vehicle',
}

/**
 * Shared mapping from schema IDs to display names (plural form)
 * Used for UI display and documentation
 */
export const SCHEMA_DISPLAY_NAME_MAP: Record<string, string> = {
  abilities: 'Abilities',
  'ability-tree-requirements': 'Ability Tree Requirements',
  'bio-titans': 'Bio-Titans',
  chassis: 'Chassis',
  classes: 'Classes',
  'crawler-bays': 'Crawler Bays',
  'crawler-tech-levels': 'Crawler Tech Levels',
  crawlers: 'Crawlers',
  creatures: 'Creatures',
  distances: 'Distances',
  drones: 'Drones',
  equipment: 'Equipment',
  keywords: 'Keywords',
  factions: 'Factions',
  meld: 'Meld',
  modules: 'Modules',
  npcs: 'NPCs',
  'roll-tables': 'Roll Tables',
  squads: 'Squads',
  systems: 'Systems',
  traits: 'Traits',
  vehicles: 'Vehicles',
}
