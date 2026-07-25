/**
 * Partner display helpers — pure functions, no JSX.
 *
 * Split out of `PartnerRows.tsx` for the same reason `railStats.ts` was split
 * out of `SheetRailParts.tsx`: a file that mixes component and non-component
 * exports breaks React Fast Refresh, and these are imported by two components
 * (`PartnerRows` and `SheetPartner`).
 */

import { resolvePartnerStatBlock } from '../../lib/rules/partnerStats'
import type { PartnerInstance } from '../../lib/schemas/partner'

/** Display name: the instance's own, else the stat block's, else the raw ref. */
export function partnerDisplayName(partner: PartnerInstance): string {
  if (partner.name && partner.name.trim() !== '') return partner.name
  const block = resolvePartnerStatBlock(partner) as { name?: string } | null
  return block?.name ?? partner.hostRef
}

/**
 * The stat block's name, shown as a partner's role so a renamed one still says
 * what it IS — "Custos" over "Survey Drone".
 */
export function partnerRoleLabel(partner: PartnerInstance): string {
  const block = resolvePartnerStatBlock(partner) as { name?: string } | null
  return block?.name ?? 'Partner'
}
