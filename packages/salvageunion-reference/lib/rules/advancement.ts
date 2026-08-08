/**
 * Pilot class advancement — which trees a pilot may draw from once they have
 * specialised into their Advanced tree or become a Hybrid Class (Core Book
 * pp. 22-23, 26, 224, 321).
 *
 * Pure functions over NEUTRAL structural inputs (ADR-006), in the style of
 * `creation.ts`: a consumer narrows its resolved reference records to the
 * primitive shapes below at the call site, so no entity union ever reaches
 * this module. No React, no IndexedDB, no app imports, and deliberately no
 * `SalvageUnionReference` import — the dataset is passed in.
 *
 * ## The shape of the rules
 *
 * The five advanceable Core classes form a ring. Each Hybrid sits on an EDGE
 * between two of them and is reachable from either end, through whichever of
 * its two trees that class owns:
 *
 *   Engineer ──Fabricator── Hacker ──Cyborg── Soldier ──Ranger── Scout
 *      └────────Union Rep──── Hauler ──Smuggler────┘
 *
 * From any origin the arithmetic is the same shape — **keep one tree, gain one
 * from your neighbour, seal two.** The kept tree is the gate you completed to
 * advance; the gained tree is the neighbour's half of the same edge; the two
 * sealed trees are the rest of your old class's core.
 *
 * Sealed does NOT mean lost. Abilities already trained in a sealed tree are
 * kept permanently and stay usable — the pilot simply cannot train NEW ones
 * ("they can retain any Abilities they have previously picked from that tree",
 * p. 321).
 *
 * The Salvager is outside the ring entirely: all 15 trees, 12 abilities, and
 * `advanceable: false`, so it is never an origin and has no destination.
 *
 * ## What is derived rather than stored
 *
 * Nothing here needs new data. A hybrid's `requirement` in
 * `ability-tree-requirements` already lists its two adjacency trees, and
 * intersecting that with a base class's `coreTrees` yields both the gate tree
 * and the reachability edge. This module is the routing that was missing.
 */

/**
 * The class shape advancement reads. `coreTrees` present and non-empty marks a
 * Core class; `hybrid` marks a Hybrid.
 *
 * Note the data asymmetry, which is real and load-bearing: a **base** class's
 * `advancedTree` is a distinct tree name ('Advanced Hacking'), while a
 * **hybrid** class's `advancedTree` is its OWN name ('Fabricator'). Never infer
 * one from the other by string convention.
 */
export type AdvancementClassInput = {
  name: string
  coreTrees?: readonly string[] | undefined
  advancedTree?: string | undefined
  legendaryTree?: string | undefined
  hybrid?: boolean | undefined
  advanceable?: boolean | undefined
}

/** The `ability-tree-requirements` shape: a tree name and what it needs. */
export type AdvancementRequirementInput = {
  name: string
  requirement: readonly string[]
}

/** The dataset advancement reads, passed in rather than imported. */
export type AdvancementDataset = {
  classes: readonly AdvancementClassInput[]
  requirements: readonly AdvancementRequirementInput[]
}

/** One reachable destination from a given Core class. */
export type AdvancementOption = {
  /** Destination class name for a hybrid, or the Advanced tree name. */
  name: string
  kind: 'advanced' | 'hybrid'
  /** The core tree that must be completed to take this path. */
  gateTree: string
  /** For a hybrid: the neighbour's tree it confers. Absent for Advanced. */
  grantedTree?: string
  /** For a hybrid: the core trees of the origin that close. Empty for Advanced. */
  sealedTrees: readonly string[]
}

/** Which trees a pilot may draw from, and which are closed to new picks. */
export type AdvancementTrees = {
  /** Trees the pilot may train NEW abilities from. */
  open: readonly string[]
  /**
   * Trees closed to new picks. Abilities already held in them are retained —
   * this is never a list of things taken away.
   */
  sealed: readonly string[]
  /** The core tree that was completed to advance, when it is known. */
  gate?: string
  /**
   * True when the destination is a hybrid whose origin could not be resolved.
   * Consumers must render this as "unknown", never seal a guessed pair.
   */
  originUnresolved: boolean
}

/** How confidently an origin was recovered from a pilot's held trees. */
export type OriginInferenceState = 'determined' | 'ambiguous' | 'contradictory'

export type OriginInference = {
  state: OriginInferenceState
  /** Set only when `state` is 'determined'. */
  origin?: string
  /** The Core classes this hybrid can be reached from, always populated. */
  candidates: readonly string[]
  /**
   * Held trees that no candidate origin and no granted tree explains — the
   * fingerprint of a free-edited pilot. Reported so a surface can mention it;
   * it never changes what is sealed.
   */
  unexplainedTrees: readonly string[]
}

function classNamed(
  data: AdvancementDataset,
  name: string | undefined
): AdvancementClassInput | undefined {
  if (name === undefined) return undefined
  return data.classes.find((c) => c.name === name)
}

function requirementFor(data: AdvancementDataset, name: string): readonly string[] {
  return data.requirements.find((r) => r.name === name)?.requirement ?? []
}

function isCore(cls: AdvancementClassInput | undefined): boolean {
  return cls !== undefined && Array.isArray(cls.coreTrees) && cls.coreTrees.length > 0
}

function isHybrid(cls: AdvancementClassInput | undefined): boolean {
  return cls !== undefined && cls.hybrid === true
}

function unique(values: readonly (string | undefined)[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if (v !== undefined && v !== '' && !out.includes(v)) out.push(v)
  }
  return out
}

/**
 * Every tree a Hybrid Class confers: its two adjacency trees, its own tree,
 * and its Legendary tree.
 *
 * This is the same set whichever origin the pilot came from — only the SEALED
 * set differs by origin, which is why the origin has to be recovered rather
 * than assumed.
 */
export function hybridGrantedTrees(data: AdvancementDataset, hybridName: string): string[] {
  const cls = classNamed(data, hybridName)
  if (!isHybrid(cls)) return []
  return unique([...requirementFor(data, hybridName), cls?.advancedTree, cls?.legendaryTree])
}

/**
 * The Core classes a given Hybrid can be reached from — the two ends of its
 * edge on the ring.
 *
 * Derived by intersecting the hybrid's adjacency trees with each class's core
 * trees, then dropping classes that cannot advance at all. The Salvager owns
 * all 15 trees and so intersects every hybrid; `advanceable: false` is what
 * excludes it, and it is the reason this filter is not optional.
 */
export function originsForHybrid(data: AdvancementDataset, hybridName: string): string[] {
  const adjacency = requirementFor(data, hybridName)
  if (adjacency.length === 0) return []
  return data.classes
    .filter((c) => isCore(c) && c.advanceable === true)
    .filter((c) => (c.coreTrees ?? []).some((t) => adjacency.includes(t)))
    .map((c) => c.name)
}

/**
 * The core tree an origin must complete to reach a destination — its own half
 * of the shared edge.
 */
export function gateTreeFor(
  data: AdvancementDataset,
  originName: string,
  hybridName: string
): string | undefined {
  const origin = classNamed(data, originName)
  if (!isCore(origin)) return undefined
  const adjacency = requirementFor(data, hybridName)
  return (origin?.coreTrees ?? []).find((t) => adjacency.includes(t))
}

/**
 * Every destination open to a Core class: its own Advanced tree, and the two
 * Hybrids on its adjacent edges.
 *
 * Returns `[]` for the Salvager and for any non-core class — a pilot who has
 * already advanced has made this choice.
 */
export function advancementOptionsFor(
  data: AdvancementDataset,
  baseClassName: string
): AdvancementOption[] {
  const base = classNamed(data, baseClassName)
  if (!isCore(base) || base?.advanceable !== true) return []
  const coreTrees = base?.coreTrees ?? []
  const options: AdvancementOption[] = []

  if (base?.advancedTree !== undefined) {
    // The Advanced tree's own requirement names the core tree that gates it.
    const gate = requirementFor(data, base.advancedTree).find((t) => coreTrees.includes(t))
    options.push({
      name: base.advancedTree,
      kind: 'advanced',
      gateTree: gate ?? '',
      // Specialising closes no core tree — "They may still take all Abilities
      // from their Core Class" (p. 321).
      sealedTrees: [],
    })
  }

  for (const cls of data.classes) {
    if (!isHybrid(cls)) continue
    if (!originsForHybrid(data, cls.name).includes(baseClassName)) continue
    const gate = gateTreeFor(data, baseClassName, cls.name)
    if (gate === undefined) continue
    const granted = hybridGrantedTrees(data, cls.name)
    options.push({
      name: cls.name,
      kind: 'hybrid',
      gateTree: gate,
      grantedTree: requirementFor(data, cls.name).find((t) => t !== gate),
      sealedTrees: coreTrees.filter((t) => !granted.includes(t)),
    })
  }

  return options
}

/**
 * Recover which Core class a hybrid pilot advanced out of, from the trees they
 * hold abilities in.
 *
 * This is reliable rather than a guess, and the rules are why: advancing
 * legally takes 6 Core abilities — 3 in the gate tree, which the hybrid grants
 * and which therefore proves nothing, plus 3 more that can only have come from
 * the origin's other two core trees. Those two trees are EXCLUSIVE to that
 * origin (verified disjoint across all five hybrids), so a rules-legal pilot
 * always carries at least three abilities only one origin can explain.
 *
 * Free Edit means that guarantee can be absent, hence three states:
 * - `determined`     — exactly one candidate is evidenced
 * - `ambiguous`      — no evidence either way (a pilot with no abilities, or
 *                      only abilities in trees the hybrid grants anyway)
 * - `contradictory`  — both candidates are evidenced, which no legal pilot can be
 *
 * Trees that no candidate explains are reported in `unexplainedTrees` but do
 * NOT change the verdict: positive evidence still resolves the origin, so a
 * pilot who free-edited one stray ability keeps their seals.
 */
export function inferOriginClass(
  data: AdvancementDataset,
  hybridName: string,
  heldTrees: readonly string[]
): OriginInference {
  const candidates = originsForHybrid(data, hybridName)
  const granted = hybridGrantedTrees(data, hybridName)
  const held = unique(heldTrees)

  const evidenced: string[] = []
  const explained = new Set<string>(granted)
  for (const candidate of candidates) {
    const cls = classNamed(data, candidate)
    const exclusive = (cls?.coreTrees ?? []).filter((t) => !granted.includes(t))
    for (const t of cls?.coreTrees ?? []) explained.add(t)
    if (exclusive.some((t) => held.includes(t))) evidenced.push(candidate)
  }

  const unexplainedTrees = held.filter((t) => !explained.has(t))

  if (evidenced.length === 1) {
    return { state: 'determined', origin: evidenced[0], candidates, unexplainedTrees }
  }
  if (evidenced.length > 1) {
    return { state: 'contradictory', candidates, unexplainedTrees }
  }
  return { state: 'ambiguous', candidates, unexplainedTrees }
}

/**
 * The trees a pilot may draw from, given where they are and where they came
 * from.
 *
 * `originName` is deliberately optional and `undefined` is a first-class
 * answer, not an error: a hybrid pilot whose origin cannot be recovered is a
 * real, reachable state (the class picker has been ungated for as long as it
 * has existed). In that case **nothing is sealed** — a guessed pair would close
 * trees the pilot may legitimately still be able to train from, and closing the
 * wrong two is worse than closing none.
 *
 * A Core-class destination means the pilot has not advanced, or has specialised
 * into their own Advanced tree; either way every core tree stays open.
 */
export function resolveAdvancementTrees(
  data: AdvancementDataset,
  originName: string | undefined,
  destName: string | undefined
): AdvancementTrees {
  const dest = classNamed(data, destName)

  if (isCore(dest)) {
    return {
      open: unique([...(dest?.coreTrees ?? []), dest?.advancedTree, dest?.legendaryTree]),
      sealed: [],
      originUnresolved: false,
    }
  }

  if (!isHybrid(dest) || destName === undefined) {
    return { open: [], sealed: [], originUnresolved: false }
  }

  const open = hybridGrantedTrees(data, destName)
  const origin = classNamed(data, originName)

  // An origin that cannot reach this hybrid explains nothing about it, so it
  // is treated exactly like an absent one rather than half-trusted.
  const reachable =
    originName !== undefined && originsForHybrid(data, destName).includes(originName)
  if (!isCore(origin) || !reachable) {
    return { open, sealed: [], originUnresolved: true }
  }

  return {
    open,
    sealed: (origin?.coreTrees ?? []).filter((t) => !open.includes(t)),
    gate: gateTreeFor(data, originName as string, destName),
    originUnresolved: false,
  }
}
