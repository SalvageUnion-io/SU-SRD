/**
 * Roster — what `/` shows, by who is looking:
 *
 *  - **Signed out** — the front door (`FrontDoor`).
 *  - **Signed in** — everything you keep, on your account (`Shelves`).
 *    Disconnected too: the whole cached pile is the only rendering that
 *    cannot lose a build.
 *
 * A Game's page is Play's (`/play/games/$gameId`, ADR-052 §5): Build renders
 * none.
 */

import { useSync } from '../../replica/syncContext'
import { Shelves } from '../shelves/Shelves'
import { FrontDoor } from './FrontDoor'

export function Roster() {
  const { status } = useSync()

  // Signed out there is nothing of theirs to list and nothing may be built:
  // every build lives in an account (ADR-034 as amended). The front door says
  // what the app is, offers the sign-in, and opens the Starter Set, which reading
  // needs no account for.
  if (status === 'signedOut') return <FrontDoor />
  return <Shelves />
}
