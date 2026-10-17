/**
 * Roster — what `/` and `/games/$gameId` show, by who is looking and which
 * container the route picked (`activeContainerStore`):
 *
 *  - **Signed out** — the front door (`FrontDoor`, board 09).
 *  - **Shelves** — everything you keep, on your account (`Shelves`, board
 *    S1). Disconnected, it is also where a remembered Game falls through
 *    to: with no live Game to show, the whole cached pile is the only rendering
 *    that cannot lose a build.
 *  - **A Game** — that table's own page, drawn as Shelves is: a full-width
 *    band carrying the Game's notched name and, beside it, the page's controls
 *    (import, backup and the Games select, whose last entry is "+ New Game"), any
 *    invitation, and `GameHub` — its roster, yours first, with every player and
 *    Mediator action below the lists. Connected only; while the connection is
 *    still being worked out, a remembered Game shows a skeleton rather than
 *    flashing the shelf first.
 *
 * At the mobile endpoint (≤ md) a Game's columns collapse to one behind a
 * segmented Pilot/Mech/Crawler switch (`RosterColumn.tsx`), whose choice is
 * kept here so it survives switching between Games.
 */

import { useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { useActiveContainer } from '../../stores/activeContainerStore'
import { ContainerSwitcher } from '../entityContainer/ContainerSwitcher'
import { useShowContainer } from '../entityContainer/useShowContainer'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { GameBand } from '../games/GameBand'
import { GameHub } from '../games/GameHub'
import { GAME_BODY, GAME_MEASURE } from '../games/hubStyles.model'
import { PageShell, RosterSkeleton } from '../index'
import { Shelves } from '../shelves/Shelves'
import { FrontDoor } from './FrontDoor'
import type { SegmentKind } from './RosterColumn'

/** The band's controls, at its end. */
export function Roster() {
  const activeContainer = useActiveContainer()
  const { mode } = useConnection()

  // Signed out there is nothing of theirs to list and nothing may be built:
  // every build lives in an account (ADR-034 as amended). The front door says
  // what the Cantina is, offers the sign-in, and opens the Starter Set, which reading
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
  const activeContainer = useActiveContainer()
  const showContainer = useShowContainer()
  /** Mobile-endpoint segmented switch — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  const controls = (
    <>
      <ImportButton ground="ink" />
      <ExportAllButton ground="ink" />
      {/* Where else to go: the select lists Shelves and every Game, and ends
          with "+ New Game". It renders nothing outside Connected. */}
      <ContainerSwitcher activeContainer={activeContainer} onSelect={showContainer} />
    </>
  )

  return gameId === null ? (
    <PageShell
      measure={GAME_MEASURE}
      stack={false}
      band={<GameBand gameId={null} name="Game" controls={controls} />}
      bodyStyle={GAME_BODY}
    >
      <RosterSkeleton />
    </PageShell>
  ) : (
    // Remount per Game, so one table's busy and error state never shows
    // on the next.
    <GameHub
      key={gameId}
      gameId={gameId}
      controls={controls}
      activeSegment={activeSegment}
      onSegmentChange={setActiveSegment}
    />
  )
}
