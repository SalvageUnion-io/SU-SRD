/**
 * What a sheet's chapter band says the unit is built as (board 10), right of
 * its name: the pilot's class, the mech's chassis, the crawler's type — a
 * label-first chip (`CLASS | Engineer`) that opens and Peeks the entity it
 * names. A ref that does not resolve keeps the stored name, as a chip that
 * goes nowhere; with nothing stored there is no chip.
 */

import type { EntityRef, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClass } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { readReference } from '../../lib/readReference'

export type BandStamp = {
  /** What the entity is to the unit: 'Class', 'Chassis', 'Type'. */
  label: string
  /** The entity's name, or the stored ref when it does not resolve. */
  name: string
  /** The entity, when it resolves: what the chip opens and Peeks. */
  entityRef?: EntityRef
}

type RefSchema = 'classes' | 'chassis' | 'crawlers'

function stampOf(
  label: string,
  schemaName: RefSchema,
  stored: string,
  entity: (SURefEntity & { name: string }) | null | undefined
): BandStamp {
  if (!entity) return { label, name: stored }
  return {
    label,
    name: entity.name,
    entityRef: { schemaName, id: entity.id, slug: getEntitySlug(entity), name: entity.name },
  }
}

export function pilotStamp(classRef: string): BandStamp | undefined {
  if (!classRef) return undefined
  return stampOf('Class', 'classes', classRef, resolveClass(classRef))
}

export function mechStamp(chassisRef: string): BandStamp | undefined {
  if (!chassisRef) return undefined
  const chassis = readReference('mechStamp', () => resolveChassisRef(chassisRef), null)
  return stampOf('Chassis', 'chassis', chassisRef, chassis)
}

export function crawlerStamp(typeRef: string | undefined): BandStamp | undefined {
  if (!typeRef) return undefined
  const type = resolveCrawlerType(typeRef)
  // An unresolved crawler type stays unsaid, as it always has.
  return type ? stampOf('Type', 'crawlers', typeRef, type) : undefined
}
