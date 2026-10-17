/**
 * The assignment model: what a soft link may join, how many of each an entity
 * may hold, and where both ends must live
 * ([ADR-037](../../../../docs/ARCHITECTURE.md#decisions), and
 * [ADR-044](../../../../docs/ARCHITECTURE.md#decisions) for crew slots).
 *
 * Pure, and shared by the client store and the Convex backend on purpose. The
 * server is the authority — `convex/entities.ts` refuses what these rules
 * refuse whatever the client sent — but a rule the client mirrors from a second
 * copy is a rule the two will eventually disagree about, so both import it
 * from here, the way both import `lib/container.ts`.
 *
 * ## The four links
 *
 * | type               | from  | to      | from holds | to holds       |
 * | ------------------ | ----- | ------- | ---------- | -------------- |
 * | `mech-to-pilot`    | mech  | pilot   | ≤ 1        | ≤ 1            |
 * | `pilot-to-crawler` | pilot | crawler | ≤ 1        | many           |
 * | `mech-to-crawler`  | mech  | crawler | ≤ 1        | many           |
 * | `npc-to-crawler`   | npc   | crawler | ≤ 1        | ≤ 1 per `slot` |
 *
 * A mech's crawler is its OWN link, never reached through its pilot, so a mech
 * is assigned independently of whoever flies it.
 *
 * An `npc-to-crawler` link names the crew slot it fills (`slot`: a bay, or the
 * crawler type's NPC), and only it does. A crawler takes many NPCs, one per
 * slot, so its `to` end is exclusive per slot rather than outright. It is the
 * one link authorised by its `to` end: whoever may write the crawler draws and
 * deletes it (ADR-044; enforced by the server).
 *
 * ## Creating a link replaces what it conflicts with
 *
 * Assigning a pilot to a second crawler is a *move*, not an error: the old
 * `pilot-to-crawler` link goes in the same write that draws the new one.
 * {@link conflictingLinks} is that rule, and the only definition of it.
 *
 * ## Both ends share a container
 *
 * Same Game, or the same owner's shelf ("Shelves", a solo Game for every
 * purpose here). A link across containers is refused, and a move prunes the
 * links it would leave straddling two. `sameContainer` from `lib/container.ts`
 * answers it on the client; the server additionally compares owners on a
 * shelf, because two players' shelves share the `null` game id.
 */
import type { Container } from '../container';
import type { EntityRef } from '../schemas/entity';
import type { CrewSlot, SoftLink } from '../schemas/softLink';
export type SoftLinkType = SoftLink['type'];
type EndType = EntityRef['type'];
/** The minimum shape of a link these rules read — a client record or a server row. */
export type LinkShape = {
    from: {
        type: EndType;
        id: string;
    };
    to: {
        type: EndType;
        id: string;
    };
    type: SoftLinkType;
    /** The crew slot an `npc-to-crawler` link fills; absent on every other type. */
    slot?: CrewSlot | undefined;
};
/**
 * Each link type's ends, and whether its `to` end is exclusive.
 *
 * The `from` end is exclusive for every type: a mech flies one pilot and docks
 * in one crawler, a pilot crews one crawler, an NPC fills one crew slot. The
 * `to` end is exclusive outright only for `mech-to-pilot` — a pilot flies one
 * mech — while a crawler takes a crew. `slotted` makes it exclusive per slot:
 * a crawler's Med Bay takes one NPC, its Mech Bay another.
 */
export declare const LINK_ENDS: Readonly<Record<SoftLinkType, {
    from: EndType;
    to: EndType;
    exclusiveTo: boolean;
    slotted: boolean;
}>>;
/** The link type joining these two ends, or null when nothing may join them. */
export declare function linkTypeFor(fromType: EndType, toType: EndType): SoftLinkType | null;
/** As {@link linkTypeFor}, but a pairing nothing may join is a programming error. */
export declare function resolveLinkType(fromType: EndType, toType: EndType): SoftLinkType;
/** Whether a link's declared type matches the kinds of its two ends. */
export declare function endsMatchType(link: LinkShape): boolean;
/** A stable key for a crew slot: `bay:<bayRef>`, `type`, or `''` for none. */
export declare function slotKey(slot: CrewSlot | undefined): string;
/**
 * Two links are the same link when type, both endpoint ids and the slot agree.
 * The slot matters only to `npc-to-crawler`: moving an NPC from the Med Bay to
 * the Mech Bay of the same crawler is a different assignment.
 */
export declare function sameLink(a: LinkShape, b: LinkShape): boolean;
/** A stable key for a link's identity — its (type, from, to) triple, plus its slot. */
export declare function linkKey(link: LinkShape): string;
/** Whether a link type names a crew slot (`npc-to-crawler`). */
export declare function isSlotted(type: SoftLinkType): boolean;
/** Every link `candidate` replaces. The one definition of cardinality. */
export declare function conflictingLinks<L extends LinkShape>(links: readonly L[], candidate: LinkShape): L[];
/**
 * The copy a player sees when a link would straddle two containers.
 *
 * One string, thrown by the client store and the server alike, so the refusal
 * reads the same whichever side caught it.
 */
export declare const CROSS_CONTAINER_REFUSAL = "Those two are in different places \u2014 assign within one Game, or in your Hangar. Move one of them first.";
/** The client's container lookup for one link end, or null when it is not cached. */
export type EndContainer = (ref: {
    type: EndType;
    id: string;
}) => Container | null;
/**
 * The links an entity loses by moving into `destination`.
 *
 * Every link touching the entity whose other end is somewhere else — or is not
 * known here at all, because a link that cannot be shown to share the new
 * container cannot be kept in it. Mirrors the server's prune in the move path
 * (`pruneLinksAcrossContainers` in `convex/model/entities.ts`).
 */
export declare function linksBrokenByMove<L extends LinkShape>(links: readonly L[], moved: {
    type: EndType;
    id: string;
}, destination: Container, containerOfEnd: EndContainer): L[];
export {};
