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
 * The group session (`useGameSession`, play.md §10): Mediate is the Mediator's
 * door whether or not one is live (ruleset §3.13); the session starts from
 * the Mediator's screen. While it is live the band also holds **End group
 * session**, and everyone else reads a **SESSION LIVE** stamp before Play.
 */

import { mediatePath } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { Badge, Button, ChapterBand, Cluster } from '../../components/index'
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
          // One cluster, so a phone's strip under the band keeps the doors on a line.
          <Cluster gap={12}>
            {mediates && (
              // The Mediator's door says who mediates: no stamp beside it.
              <Cluster gap={8}>
                {/* The Mediator's door is the band's one rust button, there
                    before a session starts (ruleset §3.13). */}
                <Button href={mediatePath(gameId)} variant="primary" size="compact">
                  {playGamesCopy('mediate')}
                </Button>
                {live && session && (
                  // Any other control on a pink band is ink (R44).
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
          </Cluster>
        ) : undefined
      }
    >
      {name}
    </ChapterBand>
  )
}
