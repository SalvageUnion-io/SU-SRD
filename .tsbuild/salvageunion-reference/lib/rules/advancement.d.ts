/**
 * Pilot class advancement — which trees a pilot may draw from once they have
 * specialised into their Advanced tree or become a Hybrid Class (Core Book
 * pp. 22-23, 26, 224, 321, 323).
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
 * p. 323).
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
    name: string;
    coreTrees?: readonly string[] | undefined;
    advancedTree?: string | undefined;
    legendaryTree?: string | undefined;
    hybrid?: boolean | undefined;
    advanceable?: boolean | undefined;
};
/** The `ability-tree-requirements` shape: a tree name and what it needs. */
export type AdvancementRequirementInput = {
    name: string;
    requirement: readonly string[];
};
/** The dataset advancement reads, passed in rather than imported. */
export type AdvancementDataset = {
    classes: readonly AdvancementClassInput[];
    requirements: readonly AdvancementRequirementInput[];
};
/** One reachable destination from a given Core class. */
export type AdvancementOption = {
    /** Destination class name for a hybrid, or the Advanced tree name. */
    name: string;
    kind: 'advanced' | 'hybrid';
    /** The core tree that must be completed to take this path. */
    gateTree: string;
    /** For a hybrid: the neighbour's tree it confers. Absent for Advanced. */
    grantedTree?: string;
    /** For a hybrid: the core trees of the origin that close. Empty for Advanced. */
    sealedTrees: readonly string[];
};
/** Which trees a pilot may draw from, and which are closed to new picks. */
export type AdvancementTrees = {
    /** Trees the pilot may train NEW abilities from. */
    open: readonly string[];
    /**
     * Trees closed to new picks. Abilities already held in them are retained —
     * this is never a list of things taken away.
     */
    sealed: readonly string[];
    /** The core tree that was completed to advance, when it is known. */
    gate?: string;
    /**
     * True when the destination is a hybrid whose origin could not be resolved.
     * Consumers must render this as "unknown", never seal a guessed pair.
     */
    originUnresolved: boolean;
};
/**
 * Every tree a Hybrid Class confers: its two adjacency trees, its own tree,
 * and its Legendary tree.
 *
 * This is the same set whichever origin the pilot came from — only the SEALED
 * set differs by origin, which is why the origin has to be recovered rather
 * than assumed.
 */
export declare function hybridGrantedTrees(data: AdvancementDataset, hybridName: string): string[];
/**
 * The Core classes a given Hybrid can be reached from — the two ends of its
 * edge on the ring.
 *
 * Derived by intersecting the hybrid's adjacency trees with each class's core
 * trees, then dropping classes that cannot advance at all. The Salvager owns
 * all 15 trees and so intersects every hybrid; `advanceable: false` is what
 * excludes it, and it is the reason this filter is not optional.
 */
export declare function originsForHybrid(data: AdvancementDataset, hybridName: string): string[];
/**
 * The core tree an origin must complete to reach a destination — its own half
 * of the shared edge.
 */
export declare function gateTreeFor(data: AdvancementDataset, originName: string, hybridName: string): string | undefined;
/**
 * Every destination open to a Core class: its own Advanced tree, and the two
 * Hybrids on its adjacent edges.
 *
 * Returns `[]` for the Salvager and for any non-core class — a pilot who has
 * already advanced has made this choice.
 */
export declare function advancementOptionsFor(data: AdvancementDataset, baseClassName: string): AdvancementOption[];
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
export declare function resolveAdvancementTrees(data: AdvancementDataset, originName: string | undefined, destName: string | undefined): AdvancementTrees;
