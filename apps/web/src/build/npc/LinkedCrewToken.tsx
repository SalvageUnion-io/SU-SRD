/**
 * LinkedCrewToken — a bay's crew slot filled by a built NPC, inside the bay
 * card (Q2, ADR-044). The bay-card form of `LinkedCrewInset`: no titled box
 * nests in an entity (N5), so the NPC is a contentful Token (N3,
 * `CrewLeadToken`), as the inline crew there is. Its dashed head opens the
 * NPC's sheet, so the User-made stamp is the only line above it.
 *
 * Read-only, as the inset: unlinking restores the inline crew exactly. A link
 * this view cannot read renders the inline crew under an "Assigned NPC
 * unavailable" badge — never a blank slot.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { npcCurrentHP } from '../../lib/npcs/npcModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { Badge, tokens, UserMadeStamp } from '../../components/index'
import { CrewLeadToken } from '../sheet/CrewLeadToken'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

type LinkedCrewTokenProps = {
  /** The bay's name — labels the crew lead for assistive tech. */
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
      <UserMadeStamp label="User-made crew" />
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
