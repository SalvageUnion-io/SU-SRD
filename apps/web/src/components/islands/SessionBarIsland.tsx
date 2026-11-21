import { gamePath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { layer, space, weight } from '../../design/tokens'
import { islandsCopy } from '../../messages/components-islands'
import { ROOMS_CALL_PATH } from '../../rooms/routes'
import { clientSwap } from '../../runtime/clientSwap'
import { Button, Callout, Text } from '../index'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import type { LiveSession } from './sessionBar.model'
import { dismissSession, liveSessionsOf, sessionsToShow } from './sessionBar.model'

/**
 * "Session live · <Game>" with its door, on a Reference page (r2 I1): a
 * player reading rules is told the table has started, as the app's own
 * notices tell them on its pages (`play/TableNotices.tsx`). Mounted only while
 * somebody is signed in (`client:signedIn`); it asks the Worker which of the
 * reader's Games have a session running (`games.liveSessions`) when it mounts,
 * when the tab comes back into view, and each minute the tab is in view. A
 * Reference page holds no room socket, so this is the whole of what it hears.
 */

/** How often a tab in view asks again. */
const ASK_EVERY_MS = 60_000

/**
 * Along the window's foot, over the page: a Reference page's band starts
 * behind the header's rail (`chapter-band-controls.css`), so a bar standing
 * between the two would leave the rail with no band.
 */
const BARS = {
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
  insetInline: 0,
  padding: `0 ${space[12]} ${space[8]}`,
  position: 'fixed',
  zIndex: layer.sticky,
} satisfies CSSProperties

const BAR = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const ACTIONS = { display: 'flex', flexWrap: 'wrap', gap: space[6] } satisfies CSSProperties

const STRONG = { fontWeight: weight.bold } satisfies CSSProperties

/** Ask the Worker; no answer (offline, signed out, an error) is no session. */
async function askWorker(): Promise<LiveSession[]> {
  try {
    const res = await fetch(ROOMS_CALL_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'games.liveSessions', args: {} }),
    })
    return res.ok ? liveSessionsOf(await res.json()) : []
  } catch {
    return []
  }
}

function tabStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function SessionBar({ ask = askWorker }: { ask?: () => Promise<LiveSession[]> }) {
  const [live, setLive] = useState<readonly LiveSession[]>([])
  const [, redraw] = useState(0)
  useEffect(() => {
    let over = false
    const read = () => {
      if (document.visibilityState !== 'visible') return
      void ask().then((sessions) => {
        if (!over) setLive(sessions)
      })
    }
    read()
    const every = window.setInterval(read, ASK_EVERY_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      over = true
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', read)
    }
  }, [ask])
  const shown = sessionsToShow(live, tabStorage())
  if (shown.length === 0) return null
  return (
    <section aria-label={islandsCopy('yourGames')} style={BARS}>
      {shown.map((session) => {
        const what = islandsCopy('sessionLiveIn', { game: session.name })
        return (
          <div key={session.gameId} role="status" data-table-notice="session">
            <Callout tone="crawler">
              <div style={BAR}>
                <Text style={STRONG}>{what}</Text>
                <span style={ACTIONS}>
                  <Button variant="primary" size="compact" href={gamePath(session.gameId)}>
                    {islandsCopy('joinSession')}
                  </Button>
                  <Button
                    size="compact"
                    aria-label={islandsCopy('dismissWhat', { what })}
                    onClick={() => {
                      dismissSession(session, tabStorage())
                      redraw((n) => n + 1)
                    }}
                  >
                    {islandsCopy('dismiss')}
                  </Button>
                </span>
              </div>
            </Callout>
          </div>
        )
      })}
    </section>
  )
}

function SessionBarIsland() {
  return (
    <IslandErrorBoundary>
      <SessionBar />
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it, swapped in over nothing (`clientSwap`). */
export const SessionBarIslandClient = clientSwap('SessionBarIsland', SessionBarIsland)
