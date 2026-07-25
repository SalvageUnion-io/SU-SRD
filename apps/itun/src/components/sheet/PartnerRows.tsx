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

import { partnerTechLevel, resolvePartnerStatBlock } from '../../lib/rules/partnerStats'
import type { PartnerInstance } from '../../lib/schemas/partner'
import { AppLink } from '../shared/AppLink'
import { partnerRailItems, rowStats } from './railStats'

/** Display name: the instance's own, else the stat block's, else the raw ref. */
export function partnerDisplayName(partner: PartnerInstance): string {
  if (partner.name && partner.name.trim() !== '') return partner.name
  const block = resolvePartnerStatBlock(partner) as { name?: string } | null
  return block?.name ?? partner.hostRef
}

/**
 * The stat block's name, shown as the row's role label so a renamed partner
 * still says what it IS — "Custos" over "Survey Drone".
 */
function partnerRoleLabel(partner: PartnerInstance): string {
  const block = resolvePartnerStatBlock(partner) as { name?: string } | null
  return block?.name ?? 'Partner'
}

type PartnerRowsProps = {
  partners: readonly PartnerInstance[]
  /**
   * The owning pilot's effective Union Crawler tech level, or undefined when
   * there is no crawler. Ignored for mech-granted partners, whose tech level is
   * fixed by their stat block — see `partnerTechLevel`.
   */
  crawlerTechLevel?: number
  /** Fired with the partner id when its row's remove control is pressed. */
  onRemove?: (partnerId: string) => void
}

export function PartnerRows({ partners, crawlerTechLevel, onRemove }: PartnerRowsProps) {
  return (
    <>
      {partners.map((partner) => {
        const techLevel = partnerTechLevel(partner, crawlerTechLevel)
        return (
          <EntityRow
            key={partner.id}
            entityType="partner"
            className="flex-[1_1_0%]"
            name={partnerDisplayName(partner)}
            sheetHref={`/sheet/partner/${partner.id}`}
            linkAs={AppLink}
            meta={partnerRoleLabel(partner)}
            metaLine={`Tech ${techLevel}`}
            stats={rowStats(partnerRailItems(partner, techLevel))}
            onDeleteClick={onRemove ? () => onRemove(partner.id) : undefined}
          />
        )
      })}
    </>
  )
}
