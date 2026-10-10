/**
 * LinkedCrewInset — a crawler crew slot filled by a built NPC (Q2, ADR-043).
 *
 * While a slot is linked, the bay card (or the type's NPC) shows the linked
 * NPC in place of its inline crew, **read-only**, with the User-made stamp and
 * a way to its own sheet: you track its HP there. Read-only is the guarantee
 * that unlinking restores the inline crew exactly — nothing writes the
 * crawler's `crawlerBays[].npc*` or `bayChoices` while a link exists.
 *
 * A link whose NPC this view cannot read (deleted elsewhere, not yet synced)
 * renders the inline crew with an "Assigned NPC unavailable" badge — never a
 * blank slot.
 */

import { Badge, tokens, UserMadeStamp } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { npcCurrentHP } from '../../lib/npcs/npcModel'
import { AppLink } from '../shared/AppLink'
import { NpcInset } from '../sheet/NpcInset'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const HEAD = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const LINK = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

type LinkedCrewInsetProps = {
  /** The bay's (or type's) name — labels the inset for assistive tech. */
  slotName: string
  assignment: CrewAssignment
  /** The inline crew, shown under the badge when the NPC cannot be read. */
  fallback: ReactNode
}

export function LinkedCrewInset({ slotName, assignment, fallback }: LinkedCrewInsetProps) {
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
      <div style={HEAD}>
        <UserMadeStamp label="User-made crew" />
        <AppLink href={`/sheet/npc/${npc.id}`} style={LINK}>
          Open {npc.name}
        </AppLink>
      </div>
      <NpcInset
        bayName={slotName}
        title={npc.position}
        name={npc.name}
        hp={npcCurrentHP(npc)}
        maxHp={npc.hitPoints}
        keepsake={npc.keepsake ?? ''}
        motto={npc.motto ?? ''}
        detail={npc.description ?? ''}
        facts={npc.facts ?? []}
      />
    </div>
  )
}
