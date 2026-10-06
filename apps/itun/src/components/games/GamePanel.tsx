/**
 * The hub's Game and Mediator sections, and the panels inside them.
 *
 * When a Game is showing, `/` lists the roster first and everything you can do
 * about the table below it, in two sections: **Game** (every member) and
 * **Mediator** (the Mediator alone). A section is a ruled band with its `h2` —
 * a peer of the roster columns' `h2`s — over a grid of panels, each an
 * ink-banded `Card` with an `h3` title: the band every Game panel already wore
 * (`DowntimePanel`, `ProposalInbox`, `MediatorPanel`), named once here.
 *
 * The grid fits as many ~26rem columns as the page has room for and drops to
 * one on a phone, without a media query: `min(100%, 26rem)` is what keeps a
 * 390px screen from scrolling sideways.
 */

import { Badge, Card, PageHeading, Text, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

const SECTION = {
  borderTop: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  marginTop: tokens.space[40],
  paddingTop: tokens.space[16],
} satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

const PANEL_GRID = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[24],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
} satisfies CSSProperties

const PANEL_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[16],
} satisfies CSSProperties

type GameSectionProps = {
  /** The heading's id, which names the section (`aria-labelledby`). */
  id: string
  title: string
  /** One line under the heading saying who the section is for. */
  hint?: string
  children: ReactNode
}

export function GameSection({ id, title, hint, children }: GameSectionProps) {
  return (
    <section aria-labelledby={id} style={SECTION}>
      <div>
        <PageHeading variant="subheading" id={id}>
          {title}
        </PageHeading>
        {hint !== undefined && (
          <Text variant="hint" style={HINT}>
            {hint}
          </Text>
        )}
      </div>
      <div style={PANEL_GRID}>{children}</div>
    </section>
  )
}

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
