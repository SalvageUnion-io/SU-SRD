/**
 * MOCK (best, revision 6): `?mock-chassis=little-sestra` shows a mech on
 * another chassis, with the drones that chassis fields, so a companion chassis
 * and its companion's sheet can be seen from the seeded Mazona. Nothing is
 * written, and the companions it mints (`mock-1`, …) are read-only.
 */
import type { Mech } from 'game-domain/schemas/mech'
import { mechPartnerSeeds, syncPartners } from '../../lib/rules/partnerGrants'

/** The page's own query, kept on a link between a host and its companion. */
export function mockQuery(): string {
  if (typeof window === 'undefined') return ''
  const slug = new URLSearchParams(window.location.search).get('mock-chassis')
  return slug ? `?mock-chassis=${encodeURIComponent(slug)}` : ''
}

export function mockChassisOf(mech: Mech): Mech {
  const slug =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('mock-chassis')
  if (!slug) return mech
  let minted = 0
  const partners = syncPartners(undefined, mechPartnerSeeds(slug), {
    mintId: () => `mock-${++minted}`,
  })
  const { startingPatternRef: _pattern, ...rest } = mech
  return { ...rest, chassisRef: slug, ...(partners ? { partners } : {}) }
}
