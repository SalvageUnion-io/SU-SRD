/**
 * The Starter Set's thirteen builds as the models `StarterCard` draws, in the
 * three columns the front door and the Starter Set page both lay them out in:
 * the art of what each is made from (a pilot's class, a mech's chassis, the
 * crawler's type), its class or chassis cells, and a pilot's motto as the lead.
 */

import type { EntityRowModel } from 'component-lib'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { readReference } from '../../lib/readReference'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from '../../lib/starterSet/starterSet'
import { unitRowModel } from '../../lib/units/unitModel'
import { crawlerStats, mechChassisStats, pilotStats } from '../roster/rowStats'
import type { EntityRowStat } from '../shared/EntityRow'

export type StarterBuild = { id: string; name: string; model: EntityRowModel }

export type StarterShelf = { kind: StarterKind; title: string; builds: StarterBuild[] }

const NO_ART: EntityRowModel['art'] = { kind: 'none' }

/** The art of the reference entity a build is made from; none when it cannot be read. */
function artOf(source: string, entity: () => SURefMetaEntity | null | undefined) {
  return readReference(
    `StarterCard.${source}`,
    () => {
      const found = entity()
      return found ? toEntityModel(found).art : NO_ART
    },
    NO_ART
  )
}

function readings(stats: EntityRowStat[] | undefined) {
  return (stats ?? []).map((s) => ({ label: String(s.label), value: String(s.value) }))
}

function findClass(ref: string) {
  return SalvageUnionReference.Classes.all().find(
    (c) => c.id === ref || c.name === ref || c.name.toLowerCase() === ref.toLowerCase()
  )
}

/** The Starter Set's three columns, built from the static seed. */
export function starterShelves(): StarterShelf[] {
  return [
    {
      kind: 'pilot',
      title: 'Pilots',
      builds: STARTER_PILOTS.map((p) => ({
        id: p.id,
        name: p.name,
        model: unitRowModel({
          kind: 'pilot',
          stamp: 'Pilot',
          name: p.name,
          readings: readings(pilotStats(p.classRef)),
          art: artOf('class', () => findClass(p.classRef)),
          lead: p.motto || undefined,
        }),
      })),
    },
    {
      kind: 'mech',
      title: 'Mechs',
      builds: STARTER_MECHS.map((m) => ({
        id: m.id,
        name: m.name,
        model: unitRowModel({
          kind: 'mech',
          stamp: 'Mech',
          name: m.name,
          readings: readings(mechChassisStats(m.chassisRef)),
          art: artOf('chassis', () => resolveChassisRef(m.chassisRef)),
        }),
      })),
    },
    {
      kind: 'crawler',
      title: STARTER_CRAWLERS.length === 1 ? 'Crawler' : 'Crawlers',
      builds: STARTER_CRAWLERS.map((c) => ({
        id: c.id,
        name: c.name,
        model: unitRowModel({
          kind: 'crawler',
          stamp: 'Crawler',
          name: c.name,
          readings: readings(crawlerStats(c.techLevel, c.crawlerBays?.length ?? 0)),
          art: artOf('crawler', () => (c.type ? resolveCrawlerType(c.type) : null)),
        }),
      })),
    },
  ]
}
