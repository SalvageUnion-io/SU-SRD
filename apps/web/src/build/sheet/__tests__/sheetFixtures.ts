/**
 * The pilot, mech and crawler the Sheet composition tests render and wire
 * together. Their refs are not in the reference data on purpose: an
 * unresolved class or system prints its slug, which the tests read.
 */

import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'

export const fakePilot = pilotFixture({
  id: 'pilot-1',
  name: 'Yara Voss',
  callsign: 'Ghost',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
})

export const fakeMech = mechFixture({
  id: 'mech-1',
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
  systems: ['heavy-blaster'],
  modules: ['shield-cell'],
  cargoLots: [
    {
      id: 'lot-medkit',
      kind: 'unit' as const,
      name: 'med-kit',
      cat: 'SEALED' as const,
      units: 1,
      code: 'MED',
    },
  ],
})

export const fakeCrawler = crawlerFixture({
  id: 'crawler-1',
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['hull-repair'],
})

export const mechToPilot = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
export const pilotToCrawler = softLinkFixture('pilot-to-crawler', 'pilot-1', 'crawler-1')
export const mechToCrawler = softLinkFixture('mech-to-crawler', 'mech-1', 'crawler-1')
