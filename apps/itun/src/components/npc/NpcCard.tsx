/**
 * NpcCard — a built NPC as the entity card it is (ADR-043).
 *
 * The stat block renders through `ReferenceEntityCard` as an `npcs` entity
 * (`npcAsReferenceEntity`), so its actions and traits read exactly as a
 * reference NPC's do, and it always wears the user-made treatment (ruleset
 * §3.9): the dashed frame and seam stamp, "Made by [maker]" in place of a page,
 * and a kicker naming what it was built from ("NPC · from Veteran").
 *
 * No "View in SRD" link: a built NPC has no page in the book, and the
 * template's would lend it one. Its nested actions have none either (they are
 * a meta schema), so the whole card renders with no external-link builder.
 */

import { EntityExternalLinkProvider, ReferenceEntityCard, tokens } from 'component-lib'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import type { NpcView } from '../../lib/npcs/npcModel'
import { npcAsReferenceEntity, npcIdentityLine, npcKicker } from '../../lib/npcs/npcModel'

const IDENTITY_LINE = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  fontStyle: 'italic',
  margin: 0,
  padding: `${tokens.space[6]} ${tokens.space[14]} 0`,
} satisfies CSSProperties

type CardProps = ComponentProps<typeof ReferenceEntityCard>

type NpcCardProps = {
  npc: NpcView
  /** The maker's display name — "Made by alxjrvs". */
  madeBy: string
  size?: CardProps['size']
  extent?: CardProps['extent']
  /** Overrides the derived kicker ("Crawler crew · Med Bay" for a slot draft). */
  kicker?: string
  /** Trailing content inside the card (the sheet's crew line). */
  afterContent?: ReactNode
}

export function NpcCard({
  npc,
  madeBy,
  size = 'large',
  extent = 'full',
  kicker,
  afterContent,
}: NpcCardProps) {
  const line = npcIdentityLine(npc)
  return (
    <EntityExternalLinkProvider value={undefined}>
      <ReferenceEntityCard
        data={npcAsReferenceEntity(npc)}
        size={size}
        extent={extent}
        userMade
        madeBy={madeBy}
        kicker={kicker ?? npcKicker(npc)}
        subtitleExtra={line ? <p style={IDENTITY_LINE}>{line}</p> : undefined}
        afterExtraContent={afterContent}
      />
    </EntityExternalLinkProvider>
  )
}
