/**
 * A book crew's builds as the models `StarterCard` draws (the Starter Set's
 * thirteen, the Quickstart's twelve), in the columns the front door and the
 * Starter Set page both lay them out in (a crew with no crawler has an empty
 * crawler column):
 * the build's own picture where the set has one (each pilot's portrait, the
 * Tenacity), else the art of what it is made from (a mech's chassis), and its
 * class or chassis cells. No lead (EDL E11): a pilot's motto
 * is on its sheet, not its Compact.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { Photo } from 'game-domain/schemas/photo'
import { photoUrl } from 'game-domain/schemas/photo'
import type { RefMetaEntity } from 'salvageunion-reference'
import { entityRef, getAssetUrl, getReferenceEntityName } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import type { EntityFormModel, TagItem } from '../../components/index'
import { relation } from '../../components/index'
import { resolveClass } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { readReference } from '../../lib/readReference'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import { starterRoster } from '../../lib/starterSet/starterTemplates'
import type { UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { crawlerStats, mechChassisStats, pilotStats } from '../roster/rowStats.model'

/**
 * One build: its Compact model, and the entity it is built on (a pilot's class, a
 * mech's chassis) as a linked chip that Peeks and opens it.
 */
export type StarterBuild = {
  id: string
  name: string
  model: EntityFormModel
  relations: TagItem[]
}

export type StarterShelf = { kind: SheetKind; title: string; builds: StarterBuild[] }

const NO_ART: EntityFormModel['art'] = { kind: 'none' }

/** A build's own photo as row art. Every Starter Set photo is CDN artwork. */
function photoArt(photo: Photo | undefined): EntityFormModel['art'] | undefined {
  return photo ? { kind: 'image', url: photoUrl(photo) } : undefined
}

/**
 * The art of the reference entity a build is made from; none when it cannot be
 * read. Its artwork alone, not its whole model (`toEntityModel`), which would
 * resolve a chassis's abilities from `actions`, a schema the front door does
 * not wait for (`roster/frontDoor.model.ts`).
 */
function artOf(source: string, entity: () => RefMetaEntity | null | undefined) {
  return readReference(
    `StarterCard.${source}`,
    (): EntityFormModel['art'] => {
      const found = entity()
      const url = found ? getAssetUrl(found) : undefined
      return url ? { kind: 'image', url } : NO_ART
    },
    NO_ART
  )
}

/** The labels a build's stats name its source entity under: drawn as its linked chip. */
const SOURCE_LABELS: ReadonlySet<string> = new Set(['Class', 'Chassis'])

function readings(stats: UnitReading[] | undefined) {
  return (stats ?? [])
    .filter((s) => !SOURCE_LABELS.has(String(s.label)))
    .map((s) => ({
      label: String(s.label),
      value: String(s.value),
      ...(s.chip ? { chip: s.chip } : {}),
    }))
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
    const ref = entityRef(found)
    const title = getReferenceEntityName(found) ?? found.name
    return [relation(`${source}-${ref.id}`, label, title, { ref })]
  }, [])
}

/** A crew's columns, built from the static seed: the Starter Set's by default. */
export function starterShelves(rosterId: StarterRosterId = 'starter-set'): StarterShelf[] {
  const roster = starterRoster(rosterId)
  return [
    {
      kind: 'pilot',
      title: 'Pilots',
      builds: roster.pilots.map((p) => ({
        id: p.id,
        name: p.name,
        model: unitRowModel({
          kind: 'pilot',
          name: p.name,
          readings: readings(pilotStats(p.classRef)),
          art: photoArt(p.photo) ?? artOf('class', () => resolveClass(p.classRef)),
        }),
        relations: sourceRelation('Class', 'class', () => resolveClass(p.classRef)),
      })),
    },
    {
      kind: 'mech',
      title: 'Mechs',
      builds: roster.mechs.map((m) => ({
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
      title: roster.crawlers.length === 1 ? 'Crawler' : 'Crawlers',
      builds: roster.crawlers.map((c) => ({
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
