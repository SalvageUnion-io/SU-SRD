/**
 * PartnerMini — a pilot's companion on the sheet as a contentful Mini (EDL E6,
 * level 2), in the Companion section's two-column MiniGrid.
 *
 * The Mini is the companion's stat block under its own name, scaled to its
 * Tech Level. Its "Details" control (both states: its SP, loadout and hold are
 * live sheet state the reference Peek cannot show) opens the whole
 * `PartnerCard` as the companion's Page (E5, R6), where every edit happens:
 * nothing expands under the line.
 */

import { useState } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { Button, Entity, EntityDetailDialog } from '../../components/index'
import type { PartnerWithHost } from '../../lib/partnerLookup'
import { partnerTechLevel, resolvePartnerStatBlock } from '../../lib/rules/partnerStats'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PartnerCardProps } from './PartnerCard'
import { PartnerCard } from './PartnerCard'
import { partnerDisplayName } from './partnerDisplay.model'

export function PartnerMini(props: PartnerCardProps & { found: PartnerWithHost }) {
  const { found, crawlerTechLevel } = props
  const { partner } = found
  const [open, setOpen] = useState(false)
  const statBlock = resolvePartnerStatBlock(partner)
  const name = partnerDisplayName(partner)
  if (!statBlock) return <PartnerCard {...props} />

  return (
    <>
      <Entity
        size="mini"
        context="inventory"
        entity={statBlock}
        instance={{ title: name, techLevel: partnerTechLevel(partner, crawlerTechLevel) }}
        mode={{ kind: 'link' }}
        body={{}}
        controls={
          <Button
            variant="pencil"
            size="mini"
            aria-label={`${name} details`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            {buildSheetCopy('details')}
          </Button>
        }
      />
      <EntityDetailDialog
        open={open}
        onOpenChange={setOpen}
        entity={statBlock as RefMetaEntity}
        title={name}
      >
        <PartnerCard {...props} presentation="page" />
      </EntityDetailDialog>
    </>
  )
}
