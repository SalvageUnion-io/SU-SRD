/**
 * usePilotSheetModel — everything the pilot Live Sheet COMPUTES, in one place.
 *
 * Three unrelated jobs, each in its own place: derive the model, mutate the
 * record, render the poster. This file is the first of those. It reads the
 * store and the reference ORM and returns
 * plain data; it never writes, and it renders nothing.
 *
 * Every value here was lifted verbatim out of `PilotSheet` — the memo
 * dependencies, the guarded ORM reads, and the reasons they are shaped the way
 * they are are preserved with their original comments, because those comments
 * record bugs that were already paid for once.
 */

import { pilotMaxima } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { GenericInventoryEntry, Pilot } from 'game-domain/schemas/pilot'
import { useMemo } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { pilotMaxAPParts, pilotMaxHPParts } from 'salvageunion-reference/rules'
import { isPilotDead, resolvePool } from 'salvageunion-reference/rules'
import type { ProvenanceLine, TreeTrack } from '../../components/index'
import { linesFromBreakdown, trackForTree } from '../../components/index'
import { resolveClass } from '../../lib/classRef'
import { readReference } from '../../lib/readReference'
import { pilotInventoryCapacity, pilotInventoryUsed } from '../../lib/rules/pilotInventory'
import type { UnitsState } from '../../replica/units'
import type { ClassLike } from '../pilot/abilityTrees.model'
import { treesFor } from '../pilot/abilityTrees.model'
import { useSoftLinks } from '../wiring/useSoftLinks'

/**
 * The tree every pilot has regardless of class (Repair, Scrap, Mount, …).
 *
 * It is INTRINSIC, not chosen: it is never offered in the abilities picker and
 * never stored in `pilot.abilities`. The sheet renders it from reference data
 * (Bonesaw reads his Generic cards although the record holds only Jury
 * Rig), in its own section AFTER the abilities the pilot owns, as Minis: every pilot has
 * the same eight, so they are reference, while the class's own abilities are
 * what tells this pilot from another.
 */
const GENERIC_TREE = 'Generic'

/**
 * One ability, keyed by the slug the pilot record actually stores. `unlearned`
 * marks one of the class's trees the pilot has not taken: the sheet prints it
 * greyed, read-only, so the whole tree reads.
 */
export type AbilityEntry = { slug: string; ability: RefAbility; unlearned?: true }

/**
 * One tree the pilot's class gives access to: all its Abilities in the tree's
 * own order, the untaken ones `unlearned`, and the track the SRD's Tree view draws it on (`trackForTree`);
 * none for a tree with no tiers.
 */
export type AbilityTreeGroup = {
  tree: string
  track: TreeTrack | undefined
  abilities: AbilityEntry[]
}

/** Core trees first, then Advanced and Hybrid, then Legendary: the order a pilot trains them. */
const TRACK_RANK: Record<TreeTrack, number> = { core: 0, advanced: 1, hybrid: 1, legendary: 2 }

/**
 * The taken Abilities by tree, each tree's in reference order (tier 1, 2, 3):
 * the trees the pilot has taken an Ability from first, then by training
 * order, then in reference order.
 */
function groupAbilityTrees(entries: readonly AbilityEntry[]): AbilityTreeGroup[] {
  const order = new Map(
    readReference(
      'pilotSheetModel.abilityOrder',
      () => SalvageUnionReference.Abilities.all().map((ability, index) => [ability.id, index]),
      [] as [string, number][]
    )
  )
  const at = (entry: AbilityEntry) => order.get(entry.ability.id) ?? Number.MAX_SAFE_INTEGER
  const byTree = new Map<string, AbilityEntry[]>()
  for (const entry of [...entries].sort((a, b) => at(a) - at(b))) {
    const group = byTree.get(entry.ability.tree)
    if (group) group.push(entry)
    else byTree.set(entry.ability.tree, [entry])
  }
  const rank = (group: AbilityTreeGroup) => (group.track ? TRACK_RANK[group.track] : 3)
  const untaken = (group: AbilityTreeGroup) =>
    group.abilities.every((entry) => entry.unlearned) ? 1 : 0
  return [...byTree]
    .map(([tree, abilities]) => ({
      tree,
      track: trackForTree(abilities.map((entry) => entry.ability)),
      abilities,
    }))
    .sort((a, b) => untaken(a) - untaken(b) || rank(a) - rank(b))
}

type PilotSheetModelOptions = {
  pilot: Pilot
  storeState: UnitsState
  /** Which picker is open — the ability-tree scope is only computed for one. */
  picker: 'abilities' | 'equipment' | null
}

export type PilotSheetModel = {
  /** The home crawler resolved through the pilot-to-crawler SoftLink. */
  linkedCrawler: Crawler | null
  effectiveCrawlerLevel: number | undefined
  /**
   * Stable `{ techLevel }` identity for the entity-card subtree.
   *
   * The subtree is not memoized — see the note on `scalingParent` below. The
   * stability is still the right shape, and is what adding a memo would need.
   */
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
  /** The abilities this pilot owns (its class's trees), in stored order. */
  classAbilities: AbilityEntry[]
  /**
   * Every tree the class gives access to (core, advanced, legendary, a hybrid's
   * origin trees, any tree already learned from), whole, by tree on their
   * tracks: the Abilities section's trees, the untaken abilities `unlearned`.
   */
  classTrees: AbilityTreeGroup[]
  /** The whole Generic tree, from reference data: its own section after them, as Minis. */
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
  // then compute the EFFECTIVE crawler Tech Level that scales choice caps
  // (e.g. the Modification choice). A linked crawler's techLevel wins; with no
  // link the pilot's manual `crawlerLevel` is used; with neither it is
  // undefined and caps stay unbounded. (The sheet has no Crawler Level slab,
  // but this scaling source stays live.)
  const { outgoing } = useSoftLinks({
    entityType: 'pilot',
    entityId: pilot.id,
    // Forward the injected store snapshot so tests drive SoftLinks through the
    // same stub; in production `storeState` is the live Zustand snapshot.
    store: storeState,
  })
  const crawlerLink = outgoing.find((link) => link.type === 'pilot-to-crawler')
  const linkedCrawler = crawlerLink ? storeState.get('crawler', crawlerLink.to.id) : null
  // The same effective level drives the pilot's Stat Training bonus to max HP
  // and AP (always derived from the crawler tier — see `pilotMaxHPParts`), so
  // every max-HP read below goes through this input: `pilotMaxima`, the one
  // derivation Play and the crew list read.
  const { statInput, hpParts, apParts, maxHP, maxAP } = pilotMaxima(pilot, linkedCrawler)
  const effectiveCrawlerLevel = statInput.crawlerTechLevel
  // Memoized so the {techLevel} object's identity is stable across renders.
  //
  // The original comment here justified this by "the React.memo on the (heavy)
  // ReferenceEntityCard subtree" — there is no such memo; the card is a plain
  // function. The memo is still worth keeping for the reason the false premise
  // was reaching for: a stable identity is the precondition for adding one, and
  // this call site is already correct for it.
  const scalingParent = useMemo(
    () => (effectiveCrawlerLevel !== undefined ? { techLevel: effectiveCrawlerLevel } : undefined),
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

  const dead = isPilotDead(statInput)
  const slotsUsed = pilotInventoryUsed(pilot)
  const slotsCap = pilotInventoryCapacity(pilot)
  const overCapacity = slotsUsed > slotsCap
  const genericInventory = pilot.genericInventory ?? []

  // Abilities offered on the live sheet are scoped to the pilot's class trees
  // (core + advanced + legendary, a hybrid's origin trees, + any tree they've
  // already learned) — the same edit-mode logic AbilitiesStep used, now feeding
  // the shared searcher's filter.
  // Computed only while the Abilities picker is open: it reads the reference ORM,
  // which read-only renders never preload (the picker never opens there).
  //
  // GENERIC is deliberately NOT in this set: those abilities are intrinsic to
  // every pilot rather than chosen, so they are never offered for selection.
  const abilityTrees = useMemo(() => {
    if (picker !== 'abilities') return null
    const cls: ClassLike | undefined = SalvageUnionReference.Classes.getById(pilot.classRef)
    if (!cls) return null
    const selectedTrees = SalvageUnionReference.Abilities.all()
      .filter((a) => pilot.abilities.includes(getEntitySlug(a)))
      .map((a) => a.tree)
    const origin =
      pilot.originClassRef === undefined
        ? undefined
        : SalvageUnionReference.Classes.getById(pilot.originClassRef)?.name
    return new Set(treesFor(cls, true, selectedTrees, origin))
  }, [picker, pilot.classRef, pilot.originClassRef, pilot.abilities])

  /**
   * The Generic tree — EVERY pilot has all of it, so it is read from the
   * reference data rather than from `pilot.abilities` (which only ever holds
   * chosen, class-tree abilities). Keyed by the ability's slug, which
   * `Abilities.getBySlug` accepts, so the used/recharge toggles persist like any
   * other ability.
   *
   * Guarded: read-only renders may not have preloaded the ORM, and a
   * missing catalog should drop the Generic cards, not throw the sheet.
   */
  const genericAbilities = useMemo(
    () =>
      readReference<AbilityEntry[]>(
        'pilotSheetModel.genericAbilities',
        () =>
          SalvageUnionReference.Abilities.all()
            .filter((ability) => ability.tree === GENERIC_TREE)
            .map((ability) => ({ slug: getEntitySlug(ability), ability })),
        []
      ),
    []
  )

  // The abilities this pilot owns in the order stored, each keyed by the slug
  // the record actually stores (`pilot.abilities`, `usedAbilities` and every
  // handler speak slugs). A Generic ability a legacy record happens to store is
  // already printed with its tree, so it is skipped.
  const classAbilities = useMemo(() => {
    const entries: AbilityEntry[] = []
    for (const slug of pilot.abilities) {
      const ability = SalvageUnionReference.Abilities.getBySlug(slug)
      if (ability && ability.tree !== GENERIC_TREE) entries.push({ slug, ability })
    }
    return entries
  }, [pilot.abilities])

  // The class's own trees and every tree taken from, whole, each on its track
  // (the SRD's Tree view): the taken abilities as stored, the rest of each
  // class tree `unlearned`.
  // Guarded as the Generic tree is: a read-only render without the ORM prints the
  // taken abilities alone.
  const classTrees = useMemo(() => {
    const taken = new Set(classAbilities.map((entry) => entry.ability.id))
    const unlearned = readReference<AbilityEntry[]>(
      'pilotSheetModel.classTrees',
      (): AbilityEntry[] => {
        // The stored ref is an id, a name or a slug (`resolveClass`).
        const cls: ClassLike | undefined = resolveClass(pilot.classRef)
        if (!cls) return []
        const origin =
          pilot.originClassRef === undefined ? undefined : resolveClass(pilot.originClassRef)?.name
        // The class's own trees, never its Advanced or Legendary ones, which
        // show once taken from.
        const trees = new Set(
          treesFor(
            cls,
            false,
            classAbilities.map((entry) => entry.ability.tree),
            origin
          )
        )
        trees.delete(GENERIC_TREE)
        return SalvageUnionReference.Abilities.all()
          .filter((ability) => trees.has(ability.tree) && !taken.has(ability.id))
          .map((ability) => ({ slug: getEntitySlug(ability), ability, unlearned: true as const }))
      },
      [] as AbilityEntry[]
    )
    return groupAbilityTrees([...classAbilities, ...unlearned])
  }, [classAbilities, pilot.classRef, pilot.originClassRef])

  /** Slugs that resolved to no SRD ability — rendered as bare fallback rows. */
  const unresolvedAbilities = pilot.abilities.filter(
    (slug) => !SalvageUnionReference.Abilities.getBySlug(slug)
  )

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
    classAbilities,
    classTrees,
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
