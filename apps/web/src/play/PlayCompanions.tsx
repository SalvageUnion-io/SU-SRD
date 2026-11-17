/**
 * PlayCompanions — a unit's companions in the Units column (play.md §4,
 * §18): a pilot's ability-granted partners, a mech's chassis drones, each a
 * Mini under its own name at its Tech Level, as the sheet's Companion section
 * lists them. Tapping one puts its card on the screen (`useOpenSheet`).
 *
 * Read-only here: a companion's SP, loadout and hold are its sheet's, edited
 * in Build like every other unit's (Play only plays).
 */

import type { PartnerInstance } from 'game-domain/schemas/partner'
import { partnerDisplayName } from '../build/sheet/partnerDisplay.model'
import { Entity, MiniGrid } from '../components/index'
import { partnerTechLevel, resolvePartnerStatBlock } from '../lib/rules/partnerStats'
import { playCopy } from '../messages/play'
import { useOpenSheet } from './useOpenSheet'

type PlayCompanionsProps = {
  host: { kind: 'pilot' | 'mech'; id: string; name: string }
  partners: readonly PartnerInstance[] | undefined
  /** The host pilot's crawler Tech Level: a pilot's companion scales with it. */
  crawlerTechLevel?: number
}

export function PlayCompanions({ host, partners, crawlerTechLevel }: PlayCompanionsProps) {
  const openSheet = useOpenSheet()
  const listed = (partners ?? []).flatMap((partner) => {
    const statBlock = resolvePartnerStatBlock(partner)
    return statBlock ? [{ partner, statBlock }] : []
  })
  if (listed.length === 0) return null
  return (
    <MiniGrid label={playCopy('companionsOf', { name: host.name })} play>
      {listed.map(({ partner, statBlock }) => {
        const name = partnerDisplayName(partner)
        const techLevel = partnerTechLevel(partner, crawlerTechLevel)
        return (
          <li key={partner.id}>
            <Entity
              size="mini"
              context="play"
              entity={{ ...statBlock, techLevel }}
              instance={{ title: name, techLevel }}
              mode={{
                kind: 'link',
                onOpen: () =>
                  openSheet({
                    kind: 'partner',
                    id: partner.id,
                    name,
                    host: { kind: host.kind, id: host.id },
                  }),
                attrs: { 'aria-label': playCopy('openSSheet', { name }) },
              }}
            />
          </li>
        )
      })}
    </MiniGrid>
  )
}
