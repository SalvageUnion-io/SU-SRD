/**
 * What a sheet's chapter band says the unit is built as, right of
 * its name: the pilot's class, the mech's chassis, the crawler's type — a
 * label-first chip (`CLASS | Engineer`) that opens and Peeks the entity it
 * names. A ref that does not resolve keeps the stored name, as a chip that
 * goes nowhere; with nothing stored there is no chip.
 */

import type { NpcTemplateKind, NpcTemplateRef } from 'game-domain/schemas/npc'
import type { EntityRef, RefEntity } from 'salvageunion-reference'
import { getEntitySlug, nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClass } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { denizenTemplate, isDenizenKind } from '../../lib/npcs/npcModel'
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

type RefSchema = 'classes' | 'chassis' | 'crawlers' | NpcTemplateKind

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
  if (templateRef === undefined || !isDenizenKind(templateRef.schema)) return undefined
  return stampOf(
    'From',
    templateRef.schema,
    templateRef.slug,
    denizenTemplate(templateRef) as (RefEntity & { name: string }) | null
  )
}

/**
 * The pattern a mech was built from: its name, and its page when it has one —
 * a saved pattern's an app route (`href`), a book pattern's a Reference page
 * (`page`), which the app's router must never take. `changed` once the mech's
 * loadout is no longer the pattern's: the band then reads "Based on".
 */
export type PatternStamp = { name: string; href?: string; page?: string; changed?: true }

/** A saved pattern as this browser holds it: its name, or with its build to compare the mech against. */
type SavedPattern =
  | string
  | { name: string; chassisRef: string; systems: string[]; modules: string[] }

/** Whether two loadouts hold the same slugs, each as many times, in any order. */
function sameLoadout(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sorted = [...b].sort()
  return [...a].sort().every((slug, index) => slug === sorted[index])
}

/**
 * Which pattern a mech was built from (`PATTERN | Nimble Hauler`, ADR-066 §4:
 * chassis, then a pattern, then a mech): a saved pattern (`sourcePattern`)
 * links to its page, named when this browser holds it; a book pattern
 * (`startingPatternRef`) links to its page under the chassis. A blank build
 * says nothing.
 *
 * The provenance is stored once and never rewritten, so what the band says is
 * read against the mech as it stands (PT-13): a loadout that is no longer the
 * pattern's is `changed`, and a mech moved to a chassis the pattern is not of
 * says nothing. A mech given without its loadout is not compared.
 */
export function mechPatternStamp(
  mech: {
    chassisRef: string
    sourcePattern?: string | undefined
    startingPatternRef?: string | undefined
    systems?: readonly string[]
    modules?: readonly string[]
  },
  saved: (patternId: string) => SavedPattern | undefined,
  /**
   * The saved pattern is known to be gone (r3 G3): nobody holds it and its
   * page answers nothing, as after its maker deleted it. The chip then says
   * so and links nowhere, where a link would open "not available".
   */
  gone = false
): PatternStamp | undefined {
  const differs = (systems: readonly string[], modules: readonly string[]) =>
    mech.systems !== undefined &&
    mech.modules !== undefined &&
    !(sameLoadout(mech.systems, systems) && sameLoadout(mech.modules, modules))
  if (mech.sourcePattern) {
    const held = saved(mech.sourcePattern)
    const href = savedPatternHref(mech.sourcePattern)
    if (held === undefined) {
      return gone
        ? { name: buildSheetCopy('patternDeleted') }
        : { name: buildSheetCopy('aSavedPattern'), href }
    }
    if (typeof held === 'string') return { name: held, href }
    if (held.chassisRef !== mech.chassisRef) return undefined
    return {
      name: held.name,
      href,
      ...(differs(held.systems, held.modules) ? { changed: true as const } : {}),
    }
  }
  const ref = mech.startingPatternRef
  if (!ref) return undefined
  const chassis = readReference('mechPatternStamp', () => resolveChassisRef(mech.chassisRef), null)
  // Unreadable reference data: the stored slug is all there is to say.
  if (!chassis) return { name: ref }
  const pattern = chassis.patterns?.find((p) => nameToSlug(p.name) === ref)
  // The chassis changed: this one has no such pattern.
  if (!pattern) return undefined
  const slugs = (items: readonly { name: string; count?: number }[]) =>
    items.flatMap((item) => new Array<string>(item.count ?? 1).fill(nameToSlug(item.name)))
  return {
    name: pattern.name,
    page: srdPatternHref(chassis, pattern),
    ...(differs(slugs(pattern.systems), slugs(pattern.modules)) ? { changed: true as const } : {}),
  }
}
