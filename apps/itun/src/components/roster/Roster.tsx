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
 *    band carrying the page's controls (the "Showing" select, import, backup,
 *    the Starter Set, "+ New game") above the Game's notched name, any
 *    invitation, and `GameHub` — its roster, yours first, with every player and
 *    Mediator action below the lists. Connected only; while the connection is
 *    still being worked out, a remembered Game shows a skeleton rather than
 *    flashing the shelf first.
 *
 * At the mobile endpoint (≤ md) a Game's columns collapse to one behind a
 * segmented Pilot/Mech/Crawler switch (`RosterColumn.tsx`), whose choice is
 * kept here so it survives switching between Games.
 */

import { buttonVariants, RosterSkeleton, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { useActiveContainer } from '../../stores/activeContainerStore'
import { ContainerSwitcher } from '../container/ContainerSwitcher'
import { useShowContainer } from '../container/useShowContainer'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { GameBand } from '../games/GameBand'
import { GameHub } from '../games/GameHub'
import { GAME_BODY } from '../games/hubStyles.model'
import { NewGameControl } from '../games/NewGameControl'
import { AppLink } from '../shared/AppLink'
import { Shelves } from '../shelves/Shelves'
import { FrontDoor } from './FrontDoor'
import type { SegmentKind } from './RosterColumn'

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
} satisfies CSSProperties

/** The band's controls row, as Shelves sets its own: the note, then the controls. */
const BAND_ROW = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 100%',
  flexWrap: 'wrap',
  gap: tokens.space[16],
  justifyContent: 'space-between',
} satisfies CSSProperties

const BAND_NOTE = {
  color: tokens.color.paper,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: 0,
} satisfies CSSProperties

const BAND_CONTROLS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const NO_UNDERLINE = { textDecorationLine: 'none' } satisfies CSSProperties

/** The paper outline Shelves' band buttons wear (`styles/shelves.css`). */
const ON_BAND_BUTTON = 'su-shelves-band__btn'

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

  const controls = (
    <div style={BAND_ROW}>
      <p style={BAND_NOTE}>
        {mode === 'connecting'
          ? 'Download a backup any time to keep a copy yourself.'
          : 'Saved to your account. A downloaded backup is still yours to keep.'}
      </p>
      <div style={BAND_CONTROLS}>
        {/* Where else to go: the select lists Shelves and every Game. It
            renders nothing outside Connected, as "+ New Game" does. */}
        <ContainerSwitcher activeContainer={activeContainer} onSelect={showContainer} />
        <ImportButton className={ON_BAND_BUTTON} onInk />
        <ExportAllButton className={ON_BAND_BUTTON} onInk />
        {/* The Starter Set: Leyline Press's pre-generated crew, read-only
            reference you copy from rather than builds of your own. */}
        <AppLink
          href="/starter"
          className={`${buttonVariants({ size: 'compact' })} ${ON_BAND_BUTTON}`}
          style={NO_UNDERLINE}
        >
          Starter Set
        </AppLink>
        <NewGameControl className={ON_BAND_BUTTON} />
      </div>
    </div>
  )

  return (
    <main style={PAGE}>
      {gameId === null ? (
        <>
          <GameBand gameId={null} name="Game" controls={controls} />
          <div className="su-page-column" style={GAME_BODY}>
            <RosterSkeleton />
          </div>
        </>
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
      )}
    </main>
  )
}
