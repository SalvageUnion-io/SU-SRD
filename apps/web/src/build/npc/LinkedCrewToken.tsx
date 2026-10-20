/**
 * LinkedCrewToken — a crawler crew slot filled by a built NPC (Q2, ADR-044):
 * a bay's, inside its bay card, and the crawler type's, in the sheet's
 * identity panel. While a slot is linked it shows the linked NPC in place of
 * its inline crew, as a contentful Token (N3, `CrewLeadToken`) as the inline
 * crew is. Its dashed head opens the NPC's sheet (you track its HP there), so
 * the HOMEBREW stamp is the only line above it.
 *
 * Read-only: nothing writes the crawler's crew fields while a link exists,
 * so unlinking restores the inline crew exactly. A link
 * this view cannot read renders the inline crew under an "Assigned NPC
 * unavailable" badge — never a blank slot.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Badge, HomebrewStamp, tokens } from '../../components/index'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { npcCurrentHP } from '../../lib/npcs/npcModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { CrewLeadToken } from '../sheet/CrewLeadToken'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

type LinkedCrewTokenProps = {
  /** The bay's (or type's) name — labels the crew lead for assistive tech. */
  slotName: string
  assignment: CrewAssignment
  /** The inline crew, shown under the badge when the NPC cannot be read. */
  fallback: ReactNode
}

export function LinkedCrewToken({ slotName, assignment, fallback }: LinkedCrewTokenProps) {
  const npc = assignment.npc
  if (npc === null) {
    return (
      <div style={STACK}>
        <Badge surface="outline">Assigned NPC unavailable</Badge>
        {fallback}
      </div>
    )
  }
  return (
    <div style={STACK}>
      <HomebrewStamp />
      <CrewLeadToken
        bayName={slotName}
        title={npc.position}
        name={npc.name}
        hp={npcCurrentHP(npc)}
        maxHp={npc.hitPoints}
        keepsake={npc.keepsake ?? ''}
        motto={npc.motto ?? ''}
        detail={npc.description ?? ''}
        facts={npc.facts ?? []}
        model={unitRowModel({ kind: 'npc', name: npc.name, userMade: true })}
        mode={{
          kind: 'link',
          href: `/sheet/npc/${npc.id}`,
          attrs: { 'aria-label': `Open ${npc.name}` },
        }}
      />
    </div>
  )
}
