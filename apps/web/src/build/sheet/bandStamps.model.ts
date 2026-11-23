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
import { droppedNames } from '../../lib/rules/chassisSwap'
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
 * loadout is no longer the pattern's: the band then reads "Pattern: X ·
 * differs" (r6 E1), one name for the link either way.
 */
export type PatternStamp = {
  name: string
  href?: string
  page?: string
  changed?: true
  /** Once `changed`: the pattern's loadout, what Bring up to date writes (r5 D2). */
  loadout?: Loadout
  /**
   * Once `changed`: what differs, as the line says it: what the pattern has
   * that the Mech lacks from the pattern's side (`Longhaul has 3 Systems this
   * Mech lacks: …`, r7 G3), what the Mech added from its own (r6 E2).
   */
  differs?: string
  /** Once `changed`: the Mech only lacks what the pattern has, so it brings them in (r7 G3). */
  lacksOnly?: true
  /** The saved pattern is this account's own: the mech may write its build over it (r6 E2). */
  own?: true
}

type Loadout = { systems: string[]; modules: string[] }

/** What `want` holds more of than `have`, slug by slug, copies counted. */
function more(want: readonly string[], have: readonly string[]): string[] {
  const left = [...have]
  return want.filter((slug) => {
    const at = left.indexOf(slug)
    if (at === -1) return true
    left.splice(at, 1)
    return false
  })
}

/** "3 Systems and 1 Module": how many of each the Mech lacks. */
function partCount(systems: number, modules: number): string {
  const parts = [
    ...(systems === 0
      ? []
      : [
          systems === 1
            ? buildSheetCopy('driftOneSystem')
            : buildSheetCopy('driftSystems', { count: systems }),
        ]),
    ...(modules === 0
      ? []
      : [
          modules === 1
            ? buildSheetCopy('driftOneModule')
            : buildSheetCopy('driftModules', { count: modules }),
        ]),
  ]
  return parts.join(buildSheetCopy('driftAnd'))
}

/**
 * How the mech differs from its pattern, by name, each side from the side
 * that has more (r7 G3): what the pattern has that the Mech lacks reads
 * "Longhaul has 2 Systems this Mech lacks: Red Laser, Green Laser", since the
 * pattern may have gained them; what the Mech added reads "added Red Laser"
 * (r6 E2).
 */
function loadoutDiffers(
  mech: Loadout,
  pattern: Loadout,
  patternName: string
): { differs: string; lacksOnly?: true } {
  const lackedSystems = more(pattern.systems, mech.systems)
  const lackedModules = more(pattern.modules, mech.modules)
  const lacked = droppedNames([...lackedSystems, ...lackedModules])
  const added = droppedNames([
    ...more(mech.systems, pattern.systems),
    ...more(mech.modules, pattern.modules),
  ])
  const addedLine = buildSheetCopy('driftAdded', { names: added.join(', ') })
  if (lacked.length === 0) {
    const said = buildSheetCopy('driftVs', { differs: addedLine, pattern: patternName })
    return { differs: said.charAt(0).toUpperCase() + said.slice(1) }
  }
  const lacks = buildSheetCopy('driftLacks', {
    pattern: patternName,
    what: partCount(lackedSystems.length, lackedModules.length),
    names: lacked.join(', '),
  })
  if (added.length === 0) return { differs: lacks, lacksOnly: true }
  return { differs: `${lacks} · ${addedLine}` }
}

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
  // Changed: what differs, and the pattern's loadout to bring it up to date to (r5 D2).
  const differs = (name: string, systems: string[], modules: string[]) =>
    mech.systems !== undefined &&
    mech.modules !== undefined &&
    !(sameLoadout(mech.systems, systems) && sameLoadout(mech.modules, modules))
      ? {
          changed: true as const,
          loadout: { systems, modules },
          ...loadoutDiffers(
            { systems: [...mech.systems], modules: [...mech.modules] },
            { systems, modules },
            name
          ),
        }
      : {}
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
    return { name: held.name, href, ...differs(held.name, held.systems, held.modules) }
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
    ...differs(pattern.name, slugs(pattern.systems), slugs(pattern.modules)),
  }
}
