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
 */

import { mediatePath } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { Badge, Button, ChapterBand, Cluster } from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { playGamesCopy } from '../../messages/play-games'

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
}: {
  gameId: string | null
  /** The Game's name; "Game" while it loads. */
  name: string
  /** The viewer mediates this Game (`games.get`'s membership flag). */
  mediator?: boolean
  /** The Play chip button, right of the name (`LaunchPlay`), after Mediate when both show. */
  actions?: ReactNode
}) {
  const mediates = mediator && gameId !== null
  return (
    <ChapterBand
      tone="play"
      measure={PAGE_MEASURE}
      id="game-band-heading"
      asideAt="controls"
      aside={
        mediates || actions ? (
          <>
            {mediates && (
              // The stamp and its link wrap as one piece, centred on each other.
              <Cluster gap={8}>
                <Badge shape="stamp" size="compact" style={STAMP_AT_COMPACT}>
                  {playGamesCopy('youMediate')}
                </Badge>
                <Button href={mediatePath(gameId)} variant="ink" size="compact">
                  {playGamesCopy('mediate')}
                </Button>
              </Cluster>
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
