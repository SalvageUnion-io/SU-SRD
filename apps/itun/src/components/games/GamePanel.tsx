/**
 * GamePanel — an ink-banded `Card` with an `h3` title, for a panel that sits
 * in a page's flow rather than in a Game page section (`InvitationsForYou`).
 * A Game's own page sets its sections with `HubSection` (board M2).
 */

import { Badge, Card, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

const PANEL_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[16],
} satisfies CSSProperties

export function GamePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card
      headerBgColor={tokens.color.ink}
      headerContent={
        <Badge shape="stamp" as="h3" size="full">
          {title}
        </Badge>
      }
    >
      <div style={PANEL_BODY}>{children}</div>
    </Card>
  )
}
