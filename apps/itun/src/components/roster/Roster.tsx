/**
 * Roster — what `/` and `/games/$gameId` show, by who is looking and which
 * container the route picked (`activeContainerStore`):
 *
 *  - **Signed out** — the front door (`FrontDoor`, board 09).
 *  - **Shelves** — everything you keep, on your account (`Shelves`, board
 *    S1). Disconnected, it is also where a remembered Game falls through
 *    to: with no live Game to show, the whole cached pile is the only rendering
 *    that cannot lose a build.
 *  - **A Game** — that table's own page: the band of hub controls
 *    (backup, import, the Starter Set, the "Showing" select, "+ New game"), any
 *    invitation, and `GameHub` — its roster, yours first, with every player and
 *    Mediator action below the lists. Connected only; while the connection is
 *    still being worked out, a remembered Game shows a skeleton rather than
 *    flashing the shelf first.
 *
 * At the mobile endpoint (≤ md) a Game's columns collapse to one behind a
 * segmented Pilot/Mech/Crawler switch (`RosterColumn.tsx`), whose choice is
 * kept here so it survives switching between Games.
 */

import { buttonVariants, PageShell, RosterSkeleton } from 'component-lib'
import { borderWidth, color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { useActiveContainer } from '../../stores/activeContainerStore'
import { ContainerSwitcher } from '../container/ContainerSwitcher'
import { useShowContainer } from '../container/useShowContainer'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { GameHub } from '../games/GameHub'
import { InvitationsForYou } from '../games/InvitationsForYou'
import { NewGameControl } from '../games/NewGameControl'
import { AppLink } from '../shared/AppLink'
import { Shelves } from '../shelves/Shelves'
import { FrontDoor } from './FrontDoor'
import type { SegmentKind } from './RosterColumn'

/** The hub-controls band: a 2px ink rule beneath it. */
const BAND = {
  borderBottom: `${borderWidth.pill} solid ${color.ink}`,
  paddingBottom: space[20],
} satisfies CSSProperties

/** The band's two clusters, pushed to either end and wrapping on a phone. */
const BAND_ROW = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[16],
  justifyContent: 'space-between',
} satisfies CSSProperties

const BAND_START = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[10],
} satisfies CSSProperties

const BAND_END = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[10],
} satisfies CSSProperties

const NO_UNDERLINE = { textDecorationLine: 'none' } satisfies CSSProperties

const BAND_NOTE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  marginTop: space[10],
} satisfies CSSProperties

const INVITES = { marginTop: space[20] } satisfies CSSProperties

/** A stable footprint, so the roster replacing the skeleton does not shift the page. */
const HUB = { minHeight: '60vh' } satisfies CSSProperties

export function Roster() {
  const activeContainer = useActiveContainer()
  const { mode } = useConnection()

  // Signed out there is nothing of theirs to list and nothing may be built:
  // every build lives in an account (ADR-034 as amended). The front door says
  // what ITUN is, offers the sign-in, and opens the Starter Set, which reading
  // needs no account for.
  if (mode === 'solo') return <FrontDoor />

  if (activeContainer.kind === 'game' && mode === 'connected') {
    return <GamePage gameId={activeContainer.gameId} />
  }
  if (activeContainer.kind === 'game' && mode === 'connecting') {
    return <GamePage gameId={null} />
  }
  return <Shelves />
}

/** A Game's own page; `gameId` null while the connection settles. */
function GamePage({ gameId }: { gameId: string | null }) {
  const { mode } = useConnection()
  const activeContainer = useActiveContainer()
  const showContainer = useShowContainer()
  /** Mobile-endpoint segmented switch — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  return (
    <PageShell stack={false}>
      <h1 className="su-sr-only">Game</h1>
      <div style={BAND}>
        <div style={BAND_ROW}>
          <div style={BAND_START}>
            <ExportAllButton />
            <ImportButton />
            {/* The Starter Set: Leyline Press's pre-generated crew, read-only
                reference you copy from rather than builds of your own. */}
            <AppLink
              href="/starter"
              className={buttonVariants({ variant: 'ghost', size: 'compact' })}
              style={NO_UNDERLINE}
            >
              Starter Set
            </AppLink>
          </div>
          {/* Where else to go, and how to get another table: the select lists
              Shelves and every Game, and "+ New game" adds one. Both render
              nothing outside Connected. */}
          <div style={BAND_END}>
            <ContainerSwitcher activeContainer={activeContainer} onSelect={showContainer} />
            <NewGameControl />
          </div>
        </div>
        <p style={BAND_NOTE}>
          {mode === 'connecting'
            ? 'Download a backup any time to keep a copy yourself.'
            : 'Saved to your account. A downloaded backup is still yours to keep.'}
        </p>
      </div>

      {/* Invites addressed to your Discord account (ADR-039) — answering one is
          how you get another table. Renders nothing when there are none. */}
      <div style={INVITES}>
        <InvitationsForYou />
      </div>

      {/* Reserve a stable footprint so the roster replacing the skeleton
          doesn't shift the rest of the page. */}
      <div style={HUB}>
        {gameId === null ? (
          <RosterSkeleton />
        ) : (
          <GameHub
            // Remount per Game, so one table's busy and error state never
            // shows on the next.
            key={gameId}
            gameId={gameId}
            activeSegment={activeSegment}
            onSegmentChange={setActiveSegment}
          />
        )}
      </div>
    </PageShell>
  )
}
