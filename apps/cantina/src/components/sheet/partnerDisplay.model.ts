/**
 * Partner display helpers — pure functions, no JSX.
 *
 * Kept out of `PartnerCard.tsx` for the same reason `railStats.model.ts` is kept out
 * of `SheetRailParts.tsx`: a file that mixes component and non-component
 * exports breaks React Fast Refresh.
 */

import type { PartnerInstance } from 'cantina-domain/schemas/partner'
import { resolvePartnerStatBlock } from '../../lib/rules/partnerStats'

/** Display name: the instance's own, else the stat block's, else the raw ref. */
export function partnerDisplayName(partner: PartnerInstance): string {
  if (partner.name && partner.name.trim() !== '') return partner.name
  const block = resolvePartnerStatBlock(partner) as { name?: string } | null
  return block?.name ?? partner.hostRef
}
