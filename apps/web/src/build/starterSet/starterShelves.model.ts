/**
 * The Starter Set's thirteen builds as the models `StarterCard` draws, in the
 * three columns the front door and the Starter Set page both lay them out in:
 * the build's own picture where the set has one (each pilot's portrait, the
 * Tenacity), else the art of what it is made from (a mech's chassis), its class
 * or chassis cells, and a pilot's motto as the lead.
 */

import type { Photo } from 'cantina-domain/schemas/photo'
import { photoUrl } from 'cantina-domain/schemas/photo'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
} from 'cantina-domain/starterSet/starterSet'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { readReference } from '../../lib/readReference'
import type { StarterKind } from '../../lib/starterSet/starterTemplates'
import type { UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import type { EntityRowModel, TagItem } from '../../components/index'
import { relation } from '../../components/index'
import { crawlerStats, mechChassisStats, pilotStats } from '../roster/rowStats.model'

/**
 * One build: its Row model, and the entity it is built on (a pilot's class, a
 * mech's chassis) as a linked chip that Peeks and opens it.
 */
export type StarterBuild = { id: string; name: string; model: EntityRowModel; relations: TagItem[] }

export type StarterShelf = { kind: StarterKind; title: string; builds: StarterBuild[] }

const NO_ART: EntityRowModel['art'] = { kind: 'none' }

/** A build's own photo as row art. Every Starter Set photo is CDN artwork. */
function photoArt(photo: Photo | undefined): EntityRowModel['art'] | undefined {
  return photo ? { kind: 'image', url: photoUrl(photo) } : undefined
}

/** The art of the reference entity a build is made from; none when it cannot be read. */
function artOf(source: string, entity: () => RefMetaEntity | null | undefined) {
  return readReference(
    `StarterCard.${source}`,
    () => {
      const found = entity()
      return found ? toEntityModel(found).art : NO_ART
    },
    NO_ART
  )
}

/** The labels a build's stats name its source entity under: drawn as its linked chip. */
const SOURCE_LABELS: ReadonlySet<string> = new Set(['Class', 'Chassis'])

function readings(stats: UnitReading[] | undefined) {
  return (stats ?? [])
    .filter((s) => !SOURCE_LABELS.has(String(s.label)))
    .map((s) => ({ label: String(s.label), value: String(s.value) }))
}

/**
 * The entity a build is made from as its relation chip, `CLASS | Engineer`
 * (`chips-and-actions.md` C11): it carries its ref, so it Peeks and opens the
 * entity. None when it cannot be read.
 */
function sourceRelation(
  label: string,
  source: string,
  entity: () => RefMetaEntity | null | undefined
): TagItem[] {
  return readReference(`StarterCard.${source}`, () => {
    const found = entity()
    if (!found) return []
    const { ref, title } = toEntityModel(found)
    return [relation(`${source}-${ref.id}`, label, title, { ref })]
  }, [])
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
          name: p.name,
          readings: readings(pilotStats(p.classRef)),
          art: photoArt(p.photo) ?? artOf('class', () => findClass(p.classRef)),
          lead: p.motto || undefined,
        }),
        relations: sourceRelation('Class', 'class', () => findClass(p.classRef)),
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
          name: m.name,
          readings: readings(mechChassisStats(m.chassisRef)),
          art: artOf('chassis', () => resolveChassisRef(m.chassisRef)),
        }),
        relations: sourceRelation('Chassis', 'chassis', () => resolveChassisRef(m.chassisRef)),
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
          name: c.name,
          readings: readings(crawlerStats(c.techLevel)),
          art:
            photoArt(c.photo) ??
            artOf('crawler', () => (c.type ? resolveCrawlerType(c.type) : null)),
        }),
        relations: [],
      })),
    },
  ]
}
