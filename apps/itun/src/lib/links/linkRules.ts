/**
 * The assignment model: what a soft link may join, how many of each an entity
 * may hold, and where both ends must live
 * ([ADR-037](../../../../../docs/adrs/ADR-037-assignment-model.md)).
 *
 * Pure, and shared by the client store and the Convex backend on purpose. The
 * server is the authority — `convex/entities.ts` refuses what these rules
 * refuse whatever the client sent — but a rule the client mirrors from a second
 * copy is a rule the two will eventually disagree about, so both import it
 * from here, the way both import `lib/container.ts`.
 *
 * ## The three links
 *
 * | type               | from  | to      | from holds | to holds |
 * | ------------------ | ----- | ------- | ---------- | -------- |
 * | `mech-to-pilot`    | mech  | pilot   | ≤ 1        | ≤ 1      |
 * | `pilot-to-crawler` | pilot | crawler | ≤ 1        | many     |
 * | `mech-to-crawler`  | mech  | crawler | ≤ 1        | many     |
 *
 * A mech's crawler is its OWN link. It used to be reached through its pilot
 * (`mech-to-pilot` then `pilot-to-crawler`), which made a mech without a pilot
 * homeless and moved a mech whenever its pilot moved. Mechs are assigned
 * independently now; there is no transitive fallback anywhere.
 *
 * ## Creating a link replaces what it conflicts with
 *
 * Assigning a pilot to a second crawler is a *move*, not an error: the old
 * `pilot-to-crawler` link goes in the same write that draws the new one.
 * {@link conflictingLinks} is that rule, and the only definition of it.
 *
 * ## Both ends share a container
 *
 * Same Game, or the same owner's shelf ("My Stuff", a solo Game for every
 * purpose here). A link across containers is refused, and a move prunes the
 * links it would leave straddling two. `sameContainer` from `lib/container.ts`
 * answers it on the client; the server additionally compares owners on a
 * shelf, because two players' shelves share the `null` game id.
 */

import type { Container } from '../container'
import { sameContainer } from '../container'
import type { EntityRef } from '../schemas/entity'
import type { SoftLink } from '../schemas/softLink'

export type SoftLinkType = SoftLink['type']
type EndType = EntityRef['type']

/** The minimum shape of a link these rules read — a client record or a server row. */
export type LinkShape = {
  from: { type: EndType; id: string }
  to: { type: EndType; id: string }
  type: SoftLinkType
}

/**
 * Each link type's ends, and whether its `to` end is exclusive.
 *
 * The `from` end is exclusive for every type: a mech flies one pilot and docks
 * in one crawler, a pilot crews one crawler. The `to` end is exclusive only for
 * `mech-to-pilot` — a pilot flies one mech — while a crawler takes a crew.
 */
export const LINK_ENDS: Readonly<
  Record<SoftLinkType, { from: EndType; to: EndType; exclusiveTo: boolean }>
> = {
  'mech-to-pilot': { from: 'mech', to: 'pilot', exclusiveTo: true },
  'pilot-to-crawler': { from: 'pilot', to: 'crawler', exclusiveTo: false },
  'mech-to-crawler': { from: 'mech', to: 'crawler', exclusiveTo: false },
}

/** The link type joining these two ends, or null when nothing may join them. */
export function linkTypeFor(fromType: EndType, toType: EndType): SoftLinkType | null {
  for (const [type, ends] of Object.entries(LINK_ENDS) as [
    SoftLinkType,
    (typeof LINK_ENDS)[SoftLinkType],
  ][]) {
    if (ends.from === fromType && ends.to === toType) return type
  }
  return null
}

/** As {@link linkTypeFor}, but a pairing nothing may join is a programming error. */
export function resolveLinkType(fromType: EndType, toType: EndType): SoftLinkType {
  const type = linkTypeFor(fromType, toType)
  if (type === null) {
    throw new Error(
      `No SoftLink type defined for ${fromType} → ${toType}. ` +
        'Supported: mech→pilot, pilot→crawler, mech→crawler.'
    )
  }
  return type
}

/** Whether a link's declared type matches the kinds of its two ends. */
export function endsMatchType(link: LinkShape): boolean {
  const ends = LINK_ENDS[link.type]
  return ends !== undefined && ends.from === link.from.type && ends.to === link.to.type
}

/** Two links are the same link when type and both endpoint ids agree. */
export function sameLink(a: LinkShape, b: LinkShape): boolean {
  return a.type === b.type && a.from.id === b.from.id && a.to.id === b.to.id
}

/** A stable key for a link's identity — its (type, from, to) triple. */
export function linkKey(link: LinkShape): string {
  return `${link.type}|${link.from.id}|${link.to.id}`
}

/**
 * Whether `existing` must go for `candidate` to be drawn.
 *
 * Same type and same `from` with a different `to` always conflicts (every
 * `from` end is exclusive). For `mech-to-pilot` the `to` end is exclusive too,
 * so another mech already flying this pilot conflicts as well. The same link
 * drawn again is not a conflict — it is the link.
 */
export function conflictsWith(existing: LinkShape, candidate: LinkShape): boolean {
  if (existing.type !== candidate.type) return false
  if (sameLink(existing, candidate)) return false
  if (existing.from.id === candidate.from.id) return true
  return LINK_ENDS[candidate.type].exclusiveTo && existing.to.id === candidate.to.id
}

/** Every link `candidate` replaces. The one definition of cardinality. */
export function conflictingLinks<L extends LinkShape>(
  links: readonly L[],
  candidate: LinkShape
): L[] {
  return links.filter((l) => conflictsWith(l, candidate))
}

/**
 * The copy a player sees when a link would straddle two containers.
 *
 * One string, thrown by the client store and the server alike, so the refusal
 * reads the same whichever side caught it.
 */
export const CROSS_CONTAINER_REFUSAL =
  'Those two are in different places — assign within one game, or within My Stuff. Move one of them first.'

/** The client's container lookup for one link end, or null when it is not cached. */
export type EndContainer = (ref: { type: EndType; id: string }) => Container | null

/**
 * The links an entity loses by moving into `destination`.
 *
 * Every link touching the entity whose other end is somewhere else — or is not
 * known here at all, because a link that cannot be shown to share the new
 * container cannot be kept in it. Mirrors the server's prune in the move path
 * (`pruneLinksAcrossContainers` in `convex/model/entities.ts`).
 */
export function linksBrokenByMove<L extends LinkShape>(
  links: readonly L[],
  moved: { type: EndType; id: string },
  destination: Container,
  containerOfEnd: EndContainer
): L[] {
  return links.filter((link) => {
    const fromIsMoved = link.from.type === moved.type && link.from.id === moved.id
    const toIsMoved = link.to.type === moved.type && link.to.id === moved.id
    if (!fromIsMoved && !toIsMoved) return false
    const other = fromIsMoved ? link.to : link.from
    const where = containerOfEnd(other)
    return where === null || !sameContainer(where, destination)
  })
}

/**
 * The `mech-to-crawler` links the old transitive model implied but never drew.
 *
 * Before ADR-037 a mech reached a crawler only through its pilot. Data written
 * then has the two hops and not the direct link, so after the change those
 * mechs would leave the bay. This proposes the direct link for every mech that
 * has a pilot, has no crawler of its own, and whose pilot crews a crawler in
 * the mech's own container.
 *
 * `links` is read in the order given and the first match wins, so a caller that
 * wants "the newest" passes them newest-first — which is how a pair that broke
 * cardinality under the old code resolves to the link that survives repair.
 * Shared by the IndexedDB migration (v17) and `maintenance.repairSoftLinks`.
 */
export function impliedMechCrawlerLinks(
  links: readonly LinkShape[],
  sameContainerFor: (mechId: string, crawlerId: string) => boolean
): LinkShape[] {
  const hasCrawler = new Set(
    links.filter((l) => l.type === 'mech-to-crawler').map((l) => l.from.id)
  )
  const out: LinkShape[] = []
  for (const pilotLink of links) {
    if (pilotLink.type !== 'mech-to-pilot') continue
    const mechId = pilotLink.from.id
    if (hasCrawler.has(mechId)) continue
    const crewLink = links.find(
      (l) => l.type === 'pilot-to-crawler' && l.from.id === pilotLink.to.id
    )
    if (crewLink === undefined) continue
    // Claimed for this mech whatever the container answer, so a second, older
    // pilot link for the same mech cannot propose a different crawler.
    hasCrawler.add(mechId)
    if (!sameContainerFor(mechId, crewLink.to.id)) continue
    out.push({
      from: { type: 'mech', id: mechId },
      to: { type: 'crawler', id: crewLink.to.id },
      type: 'mech-to-crawler',
    })
  }
  return out
}
