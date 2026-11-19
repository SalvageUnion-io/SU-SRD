/**
 * What a sheet's chapter band says the unit is built as, right of
 * its name: the pilot's class, the mech's chassis, the crawler's type — a
 * label-first chip (`CLASS | Engineer`) that opens and Peeks the entity it
 * names. A ref that does not resolve keeps the stored name, as a chip that
 * goes nowhere; with nothing stored there is no chip.
 */

import type { NpcTemplateRef } from 'game-domain/schemas/npc'
import type { EntityRef, RefEntity } from 'salvageunion-reference'
import { getEntitySlug, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClass } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { srdPatternHref } from '../../lib/patternHref'
import { savedPatternHref } from '../../lib/patterns/patterns'
import { readReference } from '../../lib/readReference'
import { buildSheetCopy } from '../../messages/build-sheet'

export type BandStamp = {
  /** What the entity is to the unit: 'Class', 'Chassis', 'Type'. */
  label: string
  /** The entity's name, or the stored ref when it does not resolve. */
  name: string
  /** The entity, when it resolves: what the chip opens and Peeks. */
  entityRef?: EntityRef
}

type RefSchema = 'classes' | 'chassis' | 'crawlers' | 'npcs'

function stampOf(
  label: string,
  schemaName: RefSchema,
  stored: string,
  entity: (RefEntity & { name: string }) | null | undefined
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

/**
 * What a built NPC started as (`FROM | Veteran`): the reference NPC its stat
 * block was filled from. Crew drafted from a bay or a crawler type, or one
 * started blank, says nothing here.
 */
export function npcStamp(templateRef: NpcTemplateRef | undefined): BandStamp | undefined {
  if (templateRef?.schema !== 'npcs') return undefined
  const npc = readReference(
    'npcStamp',
    () => SalvageUnionReference.NPCs.getBySlug(templateRef.slug) ?? null,
    null
  )
  return stampOf('From', 'npcs', templateRef.slug, npc)
}

/** The pattern a mech was built from: its name, and its page when it has one. */
export type PatternStamp = { name: string; href?: string }

/**
 * Which pattern a mech was built from (`PATTERN | Nimble Hauler`, ADR-066 §4:
 * chassis, then a pattern, then a mech): a saved pattern (`sourcePattern`)
 * links to its page, named when this browser holds it; a book pattern
 * (`startingPatternRef`) links to its page under the chassis. A blank build
 * says nothing.
 */
export function mechPatternStamp(
  mech: {
    chassisRef: string
    sourcePattern?: string | undefined
    startingPatternRef?: string | undefined
  },
  savedName: (patternId: string) => string | undefined
): PatternStamp | undefined {
  if (mech.sourcePattern) {
    return {
      name: savedName(mech.sourcePattern) ?? buildSheetCopy('aSavedPattern'),
      href: savedPatternHref(mech.sourcePattern),
    }
  }
  const ref = mech.startingPatternRef
  if (!ref) return undefined
  const chassis = readReference('mechPatternStamp', () => resolveChassisRef(mech.chassisRef), null)
  const pattern = chassis?.patterns?.find((p) => nameToSlug(p.name) === ref)
  return chassis && pattern
    ? { name: pattern.name, href: srdPatternHref(chassis, pattern) }
    : { name: ref }
}
