/**
 * usePilotSheetModel — everything the pilot Live Sheet COMPUTES, in one place.
 *
 * The pilot body was ~850 lines because three unrelated jobs shared one
 * function: derive the model, mutate the record, render the poster. This file
 * is the first of those. It reads the store and the reference ORM and returns
 * plain data; it never writes, and it renders nothing.
 *
 * Every value here was lifted verbatim out of `PilotSheet` — the memo
 * dependencies, the guarded ORM reads, and the reasons they are shaped the way
 * they are are preserved with their original comments, because those comments
 * record bugs that were already paid for once.
 */

import type { ProvenanceLine } from 'component-lib'
import { linesFromBreakdown } from 'component-lib'
import { useMemo } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolvePool } from 'salvageunion-reference/rules'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { isPilotDead, pilotMaxAPParts, pilotMaxHPParts } from '../../lib/rules/derivedStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'
import type { ClassLike } from '../pilot/abilityTrees'
import { treesFor } from '../pilot/abilityTrees'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { resolveAbility } from './pilotAbilities'
import { pilotInventoryCapacity, pilotInventoryUsed } from './pilotInventory'
import type { SheetStoreState } from './sheetViewProps'

/**
 * The tree every pilot has regardless of class (Repair, Scrap, Mount, …).
 *
 * It is INTRINSIC, not chosen: it is never offered in the abilities picker and
 * never stored in `pilot.abilities`. The sheet renders it from reference data,
 * as its own tree above the class trees.
 */
export const GENERIC_TREE = 'Generic'

/** One learned ability, keyed by the slug the pilot record actually stores. */
export type AbilityEntry = { slug: string; ability: SURefAbility }

type PilotSheetModelOptions = {
  pilot: Pilot
  storeState: SheetStoreState
  /** Which picker is open — the ability-tree scope is only computed for one. */
  picker: 'abilities' | 'equipment' | null
}

export type PilotSheetModel = {
  /** The home crawler resolved through the pilot-to-crawler SoftLink. */
  linkedCrawler: Crawler | null
  effectiveCrawlerLevel: number | undefined
  /** Stable `{ techLevel }` identity for the memoized entity-card subtree. */
  scalingParent: { techLevel: number } | undefined
  partners: NonNullable<Pilot['partners']>
  /** Equipment slugs whose card is NOT replaced by a partner instance. */
  ordinaryEquipment: string[]
  /** How many of each stat block is fielded, so a card can say "2 of 2". */
  fieldedByRef: Record<string, number>
  dead: boolean
  slotsUsed: number
  slotsCap: number
  overCapacity: boolean
  genericInventory: GenericInventoryEntry[]
  /** Trees offerable in the abilities picker; null when it is closed. */
  abilityTrees: Set<string> | null
  /** Learned abilities grouped by tree (Generic excluded — it is intrinsic). */
  abilityGroups: { trees: [string, AbilityEntry[]][] }
  genericAbilities: AbilityEntry[]
  /** Slugs that resolved to no SRD ability — rendered as bare fallback rows. */
  unresolvedAbilities: string[]
  hpParts: ReturnType<typeof pilotMaxHPParts>
  apParts: ReturnType<typeof pilotMaxAPParts>
  hpLines: ProvenanceLine[]
  apLines: ProvenanceLine[]
  maxHP: number
  maxAP: number
  hp: number
  ap: number
  tp: number
}

export function usePilotSheetModel({
  pilot,
  storeState,
  picker,
}: PilotSheetModelOptions): PilotSheetModel {
  // Resolve the pilot's crawler (if any) via the pilot-to-crawler SoftLink,
  // then compute the EFFECTIVE crawler Tech Level used to scale choice caps
  // (e.g. the Modification choice). A linked crawler's techLevel wins; with no
  // link the pilot's manual `crawlerLevel` is used; with neither it is
  // undefined and caps stay unbounded. (The Crawler Level slab UI is dropped
  // — #410 — but this scaling source stays live.)
  const { outgoing } = useSoftLinks({
    entityType: 'pilot',
    entityId: pilot.id,
    // Forward the injected store snapshot so tests drive SoftLinks through the
    // same stub; in production `storeState` is the live Zustand snapshot.
    store: storeState,
  })
  const crawlerLink = outgoing.find((link) => link.type === 'pilot-to-crawler')
  const linkedCrawler = crawlerLink ? storeState.get('crawler', crawlerLink.to.id) : null
  const effectiveCrawlerLevel = resolveEffectiveCrawlerLevel(pilot, linkedCrawler)
  // Memoized so the {techLevel} object's identity is stable across renders —
  // a fresh literal each render would defeat the React.memo on the (heavy)
  // ReferenceEntityCard subtree it is threaded into.
  const scalingParent = useMemo(
    () => (effectiveCrawlerLevel !== undefined ? { techLevel: effectiveCrawlerLevel } : undefined),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- intentional: effectiveCrawlerLevel is a derived scalar, memoized purely to keep the {techLevel} object identity stable for the memoized ReferenceEntityCard subtree
    [effectiveCrawlerLevel]
  )

  // PARTNERS — the statted companions a pilot ability grants (Auto-Turret,
  // Survey Drone, Mecha Companion). The granting equipment slug and the granted
  // partner are the SAME entry in the player's eyes, so the partner instance
  // renders IN PLACE of the ordinary equipment card rather than beside it: one
  // card, one thing. Each instance gets its own card, which is what makes Mecha
  // Packmaster's two Mecha Companions two cards over one equipment slug.
  const partners = pilot.partners ?? []
  const partnerSlugs = new Set(
    partners.filter((p) => p.hostSchema === 'equipment').map((p) => p.hostRef)
  )
  const ordinaryEquipment = pilot.equipment.filter((slug) => !partnerSlugs.has(slug))
  // How many of each stat block is fielded, so a card can say "2 of 2".
  const fieldedByRef = partners.reduce<Record<string, number>>((acc, p) => {
    acc[p.hostRef] = (acc[p.hostRef] ?? 0) + 1
    return acc
  }, {})

  const dead = isPilotDead(pilot)
  const slotsUsed = pilotInventoryUsed(pilot)
  const slotsCap = pilotInventoryCapacity(pilot)
  const overCapacity = slotsUsed > slotsCap
  const genericInventory = pilot.genericInventory ?? []

  // Abilities offered on the live sheet are scoped to the pilot's class trees
  // (core + advanced + legendary + any tree they've already learned) — the same
  // edit-mode logic AbilitiesStep used, now feeding the shared searcher's filter.
  // Computed only while the Abilities picker is open: it reads the reference ORM,
  // which read-only snapshot renders never preload (the picker never opens there).
  //
  // GENERIC is deliberately NOT in this set: those abilities are intrinsic to
  // every pilot rather than chosen, so they are never offered for selection —
  // they are rendered from reference data in their own tree below.
  const abilityTrees = useMemo(() => {
    if (picker !== 'abilities') return null
    const cls: ClassLike | undefined = SalvageUnionReference.Classes.getById(pilot.classRef)
    if (!cls) return null
    const selectedTrees = SalvageUnionReference.Abilities.all()
      .filter((a) => pilot.abilities.includes(a.id))
      .map((a) => a.tree)
    return new Set(treesFor(cls, true, selectedTrees))
  }, [picker, pilot.classRef, pilot.abilities])

  // Learned abilities grouped by tree — the section renders one sub-slab per
  // tree rather than one flat grid. Generic is excluded here and sourced
  // separately: it is intrinsic, so a pilot never "has" it in `abilities`.
  const abilityGroups = useMemo(() => {
    // Keyed by the STORED slug, not `ability.id`: `pilot.abilities` (and
    // `usedAbilities`, and every handler) speak slugs, and the two are not the
    // same string — grouping by id silently broke the used/recharge lookups.
    const byTree = new Map<string, AbilityEntry[]>()
    for (const slug of pilot.abilities) {
      const ability = resolveAbility(slug)
      if (!ability || ability.tree === GENERIC_TREE) continue
      const entry = { slug, ability }
      const list = byTree.get(ability.tree)
      if (list) list.push(entry)
      else byTree.set(ability.tree, [entry])
    }
    return { trees: [...byTree.entries()] }
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- keyed on the slug list; resolveAbility is a pure ORM lookup
  }, [pilot.abilities])

  /**
   * The Generic tree — EVERY pilot has all of it, so it is read from the
   * reference data rather than from `pilot.abilities` (which only ever holds
   * chosen, class-tree abilities). Keyed by `ability.id`, which `resolveAbility`
   * accepts, so the used/recharge toggles persist like any other ability.
   *
   * Guarded: read-only snapshot renders may not have preloaded the ORM, and a
   * missing catalog should drop the section, not throw the sheet.
   */
  const genericAbilities = useMemo(() => {
    try {
      return SalvageUnionReference.Abilities.all()
        .filter((ability) => ability.tree === GENERIC_TREE)
        .map((ability) => ({ slug: ability.id, ability }))
    } catch {
      return []
    }
  }, [])

  /** Slugs that resolved to no SRD ability — rendered as bare fallback rows. */
  const unresolvedAbilities = pilot.abilities.filter((slug) => !resolveAbility(slug))

  const hpParts = pilotMaxHPParts(pilot)
  const apParts = pilotMaxAPParts(pilot)

  // Stat provenance ledgers (ADR-029). Injuries ride the contribution line —
  // a negative rules-sourced addend, derived from `injuries` so healing restores
  // max HP with no bookkeeping.
  const hpLines = linesFromBreakdown(hpParts, {
    base: 'Pilot',
    baseDetail: 'base',
    installed: 'Injuries',
    installedDetail: 'rules A11',
  })
  const apLines = linesFromBreakdown(apParts, { base: 'Pilot', baseDetail: 'base' })
  const maxHP = Math.max(0, hpParts.total)
  const maxAP = Math.max(0, apParts.total)
  const hp = resolvePool(pilot.currentHP, maxHP)
  const ap = resolvePool(pilot.currentAP, maxAP)
  const tp = pilot.trainingPoints ?? 0

  return {
    linkedCrawler,
    effectiveCrawlerLevel,
    scalingParent,
    partners,
    ordinaryEquipment,
    fieldedByRef,
    dead,
    slotsUsed,
    slotsCap,
    overCapacity,
    genericInventory,
    abilityTrees,
    abilityGroups,
    genericAbilities,
    unresolvedAbilities,
    hpParts,
    apParts,
    hpLines,
    apLines,
    maxHP,
    maxAP,
    hp,
    ap,
    tp,
  }
}
