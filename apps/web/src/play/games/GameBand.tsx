/**
 * GameBand — the head of a Game's own page (ADR-052 §5): Play's
 * chapter band (the Manage context's band, ruleset §1.9) whose row keeps the
 * page's 75rem measure, the Game's name notched into its foot as the page's
 * `h1`, and the ways into the Cockpit beside it on the band's foot, wrapping up
 * over the name when they do not fit (`asideAt="controls"`).
 *
 * Every member gets a way into the Cockpit. The
 * Mediator's is a **Mediate** chip after a **YOU MEDIATE** stamp, opening
 * Play's Mediator screen (`/play/games/$gameId/mediate`, play.md §10); a pilot's is
 * the hub's `actions`, a **Play** chip that asks which pilot to play
 * (`LaunchPlay`), beside Mediate when the Mediator plays one too.
 *
 * The group session (`useGameSession`, play.md §10): until one is live the
 * Mediator's chip is **Start group session**, which starts it and opens the
 * Mediator's screen; while it is live, Mediate and **End group session**, and
 * everyone else reads a **SESSION LIVE** stamp before Play.
 */

import { mediatePath } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { Badge, Button, ChapterBand, Cluster } from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { playCopy } from '../../messages/play'
import { playGamesCopy } from '../../messages/play-games'
import type { GameSession } from '../useGameSession'

/**
 * The stamp shares its line with the Compact Mediate (§4.7): it is drawn that
 * Size's height, its words centred, and lifts with it on touch.
 */
const STAMP_AT_COMPACT = {
  alignItems: 'center',
  boxSizing: 'border-box',
  display: 'inline-flex',
  height: 'var(--size-compact)',
} satisfies CSSProperties

export function GameBand({
  gameId,
  name,
  mediator = false,
  actions,
  session,
}: {
  gameId: string | null
  /** The Game's name; "Game" while it loads. */
  name: string
  /** The viewer mediates this Game (`games.get`'s membership flag). */
  mediator?: boolean
  /** The Play chip button, right of the name (`LaunchPlay`), after Mediate when both show. */
  actions?: ReactNode
  /** The Game's group session (`useGameSession`); null while it loads. */
  session?: GameSession | null
}) {
  const go = useGo()
  const mediates = mediator && gameId !== null
  const live = session?.live === true
  return (
    <ChapterBand
      tone="play"
      measure={PAGE_MEASURE}
      id="game-band-heading"
      asideAt="controls"
      aside={
        mediates || actions || live ? (
          <>
            {mediates && (
              // The stamp and its link wrap as one piece, centred on each other.
              <Cluster gap={8}>
                <Badge shape="stamp" size="compact" style={STAMP_AT_COMPACT}>
                  {playGamesCopy('youMediate')}
                </Badge>
                {live || !session ? (
                  <Button href={mediatePath(gameId)} variant="ink" size="compact">
                    {playGamesCopy('mediate')}
                  </Button>
                ) : (
                  // Start the session, then open the Mediator's screen.
                  <Button
                    variant="ink"
                    size="compact"
                    disabled={!session.canWrite || session.pending}
                    onClick={() => {
                      void session.start().then((started) => {
                        if (started) go(mediatePath(gameId))
                      })
                    }}
                  >
                    {playCopy('startGroupSession')}
                  </Button>
                )}
                {live && session && (
                  // R44: a control on a pink band is ink.
                  <Button
                    variant="ink"
                    size="compact"
                    disabled={!session.canWrite || session.pending}
                    onClick={session.end}
                  >
                    {playCopy('endGroupSession')}
                  </Button>
                )}
              </Cluster>
            )}
            {live && !mediates && (
              <Badge shape="stamp" size="compact" style={STAMP_AT_COMPACT}>
                {playCopy('sessionLive')}
              </Badge>
            )}
            {actions}
          </>
        ) : undefined
      }
    >
      {name}
    </ChapterBand>
  )
}
