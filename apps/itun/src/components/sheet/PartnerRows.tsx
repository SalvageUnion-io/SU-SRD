/**
 * PartnerRows — a host's statted Drones / Companions, as linked entity rows.
 *
 * One component for both hosts because a partner reads the same either way: a
 * pilot's ability-granted companions (Auto-Turret, Survey Drone, Mecha
 * Companion) and a mech's chassis-fielded drones (Sestra Drone, Big Brother
 * Drone) differ only in where their tech level comes from, which the caller has
 * already resolved by the time it gets here.
 *
 * Rendered as `EntityRow`s in the partner tone — the sixth ontology hue — for
 * the reason the hue exists: on a mech sheet these rows sit directly beneath the
 * mech's own linked units, which is exactly where "reads like a mech" would stop
 * being harmless.
 *
 * Rows navigate to `/sheet/partner/:id`. Partners deliberately have no index
 * route (they are not roster citizens and have no independent existence), so
 * this section and a direct link are the only ways to reach one.
 */

import { EntityRow } from 'component-lib'

import { partnerCap, partnerTechLevel } from '../../lib/rules/partnerStats'
import type { PartnerInstance } from '../../lib/schemas/partner'
import { AppLink } from '../shared/AppLink'
import { partnerDisplayName, partnerRoleLabel } from './partnerDisplay'
import { partnerRailItems, rowStats } from './railStats'

type PartnerRowsProps = {
  partners: readonly PartnerInstance[]
  /**
   * The owning pilot's effective Union Crawler tech level, or undefined when
   * there is no crawler. Ignored for mech-granted partners, whose tech level is
   * fixed by their stat block — see `partnerTechLevel`.
   */
  crawlerTechLevel?: number
  /**
   * The host's ability slugs. Only used to resolve the per-partner CAP, which
   * a second ability can raise — Mecha Packmaster (Core Book p. 69) takes Mecha
   * Companion from one to two — so the cap cannot be read off the stat block
   * alone. Omit for mech hosts, whose chassis-fielded drones have no such
   * modifier.
   */
  hostAbilityRefs?: readonly string[]
  /** Fired with the partner id when its row's remove control is pressed. */
  onRemove?: (partnerId: string) => void
}

export function PartnerRows({
  partners,
  crawlerTechLevel,
  hostAbilityRefs = [],
  onRemove,
}: PartnerRowsProps) {
  // How many of each stat block the host fields, so a row can say "2 of 2".
  const fielded = new Map<string, number>()
  for (const p of partners) fielded.set(p.hostRef, (fielded.get(p.hostRef) ?? 0) + 1)

  return (
    <>
      {partners.map((partner) => {
        const techLevel = partnerTechLevel(partner, crawlerTechLevel)
        // Advisory only: over-cap is SHOWN, never blocked (ADR-007, and the
        // Live Sheet is a Free-Edit surface per ADR-021).
        const cap = partnerCap(partner.hostRef, hostAbilityRefs)
        const used = fielded.get(partner.hostRef) ?? 1
        const capNote = used > 1 || used > cap ? ` · ${used} of ${cap}` : ''
        return (
          <EntityRow
            key={partner.id}
            entityType="partner"
            className="flex-[1_1_0%]"
            name={partnerDisplayName(partner)}
            sheetHref={`/sheet/partner/${partner.id}`}
            linkAs={AppLink}
            meta={partnerRoleLabel(partner)}
            metaLine={`Tech ${techLevel}${capNote}`}
            stats={rowStats(partnerRailItems(partner, techLevel))}
            onDeleteClick={onRemove ? () => onRemove(partner.id) : undefined}
          />
        )
      })}
    </>
  )
}
