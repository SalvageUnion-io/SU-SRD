/**
 * resolveSheetComposition — the SoftLink composition-mode resolver, ported
 * from the pre-Header-C Sheet.tsx (plan 4.0: "ported, not discarded") as a
 * pure function so the LiveSheet shell, the rail, and tests all share it.
 *
 * Every relationship is ONE hop over the SoftLink graph (ADR-037):
 *
 *   kind=mech    + mech-to-pilot outgoing             → pilot
 *                + mech-to-crawler outgoing           → crawler
 *   kind=pilot   + mech-to-pilot incoming             → mech
 *                + pilot-to-crawler outgoing          → crawler
 *   kind=crawler + pilot-to-crawler incoming          → crawlerPilots (pilot =
 *                                                       the first of them)
 *                + mech-to-crawler incoming           → crawlerMechs (mech =
 *                                                       the first of them)
 *   any of the above                                  → 'wired'
 *   no links                                          → '<kind>-only'
 *
 * A mech's crawler is its own link, and a mech with none has no crawler —
 * there is deliberately no fallback through the pilot, or a mech assigned elsewhere would still read as
 * docked wherever its pilot crews.
 *
 * All reads are dep-injectable: pass a snapshot `EntityLookup` + the full
 * SoftLink list (orphaned links resolve to null entities and are skipped).
 */

import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { crewAssignmentsOf } from '../../lib/npcs/npcModel'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef, SheetEntityKind } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { EntityForType } from '../../stores/types'

type CompositionMode = 'wired' | 'pilot-only' | 'mech-only' | 'crawler-only'

/**
 * Minimal read surface. Returns EntityForType<T> (the store's own mapping) so the live store's
 * generic `get` is directly assignable without a cast.
 */
export type EntityLookup = {
  get: <T extends EntityRef['type']>(type: T, id: string) => EntityForType<T> | null
}

export type SheetComposition = {
  mode: CompositionMode
  /** The linked pilot (for crawlers: the lead pilot — first wired). */
  pilot: Pilot | null
  /** The linked mech (for crawlers: the first docked mech). */
  mech: Mech | null
  crawler: Crawler | null
  /** Every pilot wired to the crawler (kind=crawler only). */
  crawlerPilots: Pilot[]
  /** Every mech docked in the crawler by its own link (kind=crawler only). */
  crawlerMechs: Mech[]
  /**
   * The crawler's crew slots filled by built NPCs (kind=crawler only;
   * ADR-043). Not part of `mode`: a crawler crewed only by NPCs is still
   * crawler-only as far as its linked units go.
   */
  crew: CrewAssignment[]
}

type ResolveArgs = {
  kind: SheetEntityKind
  id: string
  links: SoftLink[]
  store: EntityLookup
}

export function resolveSheetComposition({ kind, id, links, store }: ResolveArgs): SheetComposition {
  const empty: SheetComposition = {
    mode: `${kind}-only`,
    pilot: null,
    mech: null,
    crawler: null,
    crawlerPilots: [],
    crawlerMechs: [],
    crew: [],
  }

  /** The one entity at the far end of an outgoing link of this type. */
  const outgoing = <T extends EntityRef['type']>(type: SoftLink['type'], to: T) => {
    const link = links.find((l) => l.type === type && l.from.id === id)
    return link ? store.get(to, link.to.id) : null
  }

  if (kind === 'mech') {
    const mech = store.get('mech', id)
    const pilot = outgoing('mech-to-pilot', 'pilot')
    const crawler = outgoing('mech-to-crawler', 'crawler')
    if (!pilot && !crawler) return { ...empty, mech }
    return { ...empty, mode: 'wired', pilot, mech, crawler }
  }

  if (kind === 'pilot') {
    const pilot = store.get('pilot', id)
    const mechLink = links.find((l) => l.type === 'mech-to-pilot' && l.to.id === id)
    const mech = mechLink ? store.get('mech', mechLink.from.id) : null
    const crawler = outgoing('pilot-to-crawler', 'crawler')
    if (!mech && !crawler) return { ...empty, pilot }
    return { ...empty, mode: 'wired', pilot, mech, crawler }
  }

  // kind === 'crawler'
  const crawler = store.get('crawler', id)
  const crew = crewAssignmentsOf(links, id, (npcId) => store.get('npc', npcId))
  const crawlerPilots = links
    .filter((l) => l.type === 'pilot-to-crawler' && l.to.id === id)
    .map((l) => store.get('pilot', l.from.id))
    .filter((p): p is Pilot => p !== null)
  const crawlerMechs = links
    .filter((l) => l.type === 'mech-to-crawler' && l.to.id === id)
    .map((l) => store.get('mech', l.from.id))
    .filter((m): m is Mech => m !== null)
  if (crawlerPilots.length === 0 && crawlerMechs.length === 0) return { ...empty, crawler, crew }
  return {
    mode: 'wired',
    pilot: crawlerPilots[0] ?? null,
    mech: crawlerMechs[0] ?? null,
    crawler,
    crawlerPilots,
    crawlerMechs,
    crew,
  }
}
