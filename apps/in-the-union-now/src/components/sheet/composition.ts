/**
 * resolveSheetComposition — the SoftLink composition-mode resolver, ported
 * from the pre-Header-C Sheet.tsx (plan 4.0: "ported, not discarded") as a
 * pure function so the LiveSheet shell, the rail, and tests all share it.
 *
 * Composition mode algorithm (one- and two-hop over the SoftLink graph):
 *
 *   kind=mech    + mech-to-pilot outgoing            → wired (pilot; + crawler
 *                                                      via the pilot's
 *                                                      pilot-to-crawler link)
 *   kind=pilot   + mech-to-pilot incoming and/or
 *                  pilot-to-crawler outgoing         → wired (mech/crawler)
 *   kind=crawler + pilot-to-crawler incoming         → wired (crawlerPilots;
 *                                                      pilot = lead pilot,
 *                                                      mech = the lead
 *                                                      pilot's docked mech)
 *   no links                                         → '<kind>-only'
 *
 * All reads are dep-injectable: pass a snapshot `EntityLookup` + the full
 * SoftLink list (orphaned links resolve to null entities and are skipped).
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'

type CompositionMode = 'wired' | 'pilot-only' | 'mech-only' | 'crawler-only'

/** Minimal read surface — matches the old Sheet.tsx dep-injection type. */
export type EntityLookup = {
  get: <T extends EntityRef['type']>(
    type: T,
    id: string
  ) => (T extends 'pilot' ? Pilot : T extends 'mech' ? Mech : Crawler) | null
}

type SheetComposition = {
  mode: CompositionMode
  /** The linked pilot (for crawlers: the lead pilot — first wired). */
  pilot: Pilot | null
  mech: Mech | null
  crawler: Crawler | null
  /** Every pilot wired to the crawler (kind=crawler only). */
  crawlerPilots: Pilot[]
}

type ResolveArgs = {
  kind: EntityRef['type']
  id: string
  links: SoftLink[]
  store: EntityLookup
}

export function resolveSheetComposition({ kind, id, links, store }: ResolveArgs): SheetComposition {
  const empty: SheetComposition = {
    mode: `${kind}-only` as CompositionMode,
    pilot: null,
    mech: null,
    crawler: null,
    crawlerPilots: [],
  }

  const pilotCrawler = (pilotId: string): Crawler | null => {
    const link = links.find((l) => l.type === 'pilot-to-crawler' && l.from.id === pilotId)
    return link ? store.get('crawler', link.to.id) : null
  }

  const pilotMech = (pilotId: string): Mech | null => {
    const link = links.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)
    return link ? store.get('mech', link.from.id) : null
  }

  if (kind === 'mech') {
    const mech = store.get('mech', id)
    const pilotLink = links.find((l) => l.type === 'mech-to-pilot' && l.from.id === id)
    const pilot = pilotLink ? store.get('pilot', pilotLink.to.id) : null
    if (!pilot) return { ...empty, mech }
    return {
      mode: 'wired',
      pilot,
      mech,
      crawler: pilotCrawler(pilot.id),
      crawlerPilots: [],
    }
  }

  if (kind === 'pilot') {
    const pilot = store.get('pilot', id)
    const mech = pilotMech(id)
    const crawler = pilotCrawler(id)
    if (!mech && !crawler) return { ...empty, pilot }
    return { mode: 'wired', pilot, mech, crawler, crawlerPilots: [] }
  }

  // kind === 'crawler'
  const crawler = store.get('crawler', id)
  const crawlerPilots = links
    .filter((l) => l.type === 'pilot-to-crawler' && l.to.id === id)
    .map((l) => store.get('pilot', l.from.id))
    .filter((p): p is Pilot => p !== null)
  if (crawlerPilots.length === 0) return { ...empty, crawler }
  const lead = crawlerPilots[0]!
  return {
    mode: 'wired',
    pilot: lead,
    mech: pilotMech(lead.id),
    crawler,
    crawlerPilots,
  }
}
