/**
 * Roster — what `/` shows, by who is looking:
 *
 *  - **Signed out** — the front door (`FrontDoor`).
 *    While the session is still settling, a browser that remembers no
 *    account (`readAccountHint`) gets the front door at once rather than a
 *    wait: it is almost always what they will see.
 *  - **Signed in** — everything you keep, on your account (`Shelves`).
 *    Disconnected too: the whole cached pile is the only rendering that
 *    cannot lose a build. The root holds this route for the front door's few
 *    schemas only (`frontDoorData.ts`), so the Shelves wait for the rest here.
 *
 * A Game's page is Play's (`/play/games/$gameId`, ADR-052 §5): Build renders
 * none.
 */

import { lazy, Suspense } from 'react'
import { GameDataGate } from '../../components/GameDataGate'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { sharedCopy } from '../../messages/components-shared'
import { useSync } from '../../replica/syncContext'
import { FrontDoor } from './FrontDoor'

/** Signed in only, so the front door's first load leaves the Shelves' code for later. */
const Shelves = lazy(() => import('../shelves/Shelves').then((m) => ({ default: m.Shelves })))

export function Roster() {
  const { status } = useSync()

  // Signed out there is nothing of theirs to list and nothing may be built:
  // every build lives in an account (ADR-034 as amended). The front door says
  // what the app is, offers the sign-in, and opens the Starter Set, which reading
  // needs no account for.
  if (status === 'signedOut') return <FrontDoor />
  if (status === 'syncing' && readAccountHint(browserStorage()) === null) return <FrontDoor />
  return (
    <GameDataGate fallback={<RoutePending label={sharedCopy('referenceData')} />}>
      <Suspense fallback={<RoutePending />}>
        <Shelves />
      </Suspense>
    </GameDataGate>
  )
}
