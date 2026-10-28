/**
 * What the front door (`FrontDoor`) needs of the reference data: the Starter
 * Set's cards read their pilots' classes (with their ability trees) and their
 * mechs' chassis, and nothing else. The app's root holds the front door for
 * these alone, not the whole dataset (`GameDataReady`), so a visitor's first
 * paint waits on ~60 KB of data rather than all of it; the rest follows in the
 * background, for the route they open next.
 *
 * `__tests__/frontDoor.model.test.ts` renders the front door with only these
 * loaded and with everything, and fails when the two differ: a card that reads
 * a schema missing here degrades silently (`readReference`), so the list is
 * proven, not trusted.
 */

export const FRONT_DOOR_SCHEMAS = [
  'abilities',
  'ability-tree-requirements',
  'chassis',
  'classes',
] as const
