/**
 * GameBand — the head of a Game's own page (board M2), drawn the way Shelves
 * draws its own: a full-width chapter band whose row keeps the SRD's 75rem
 * measure, the Game's name notched into its foot as the page's `h1`, and the
 * page's controls beside it on the band's foot, wrapping up over the name
 * when they do not fit (`asideAt="controls"`). The band is the crawler's
 * pink, because a Game is the crew and its Union Crawler; the deeper
 * `crawlerBand`, since its controls are paper (the book's crawler pink carries
 * neither ink nor paper at 4.5 : 1).
 *
 * Every member gets one way into Play (wireframe play-entry). The Mediator's
 * is a **Mediate** chip after a **YOU MEDIATE** stamp, opening Play's Mediator
 * screen (`/play/game/$gameId`, play.md §10); a player's is the hub's
 * `actions`, a **Play** chip that asks which pilot to play (`LaunchPlay`).
 */

import type { ReactNode } from 'react'
import { Badge, buttonVariants, ChapterBand, Cluster, tokens } from '../index'
import { AppLink } from '../shared/AppLink'
import { GAME_MEASURE } from './hubStyles.model'

export function GameBand({
  gameId,
  name,
  mediator = false,
  controls,
  actions,
}: {
  gameId: string | null
  /** The Game's name; "Game" while it loads. */
  name: string
  /** The viewer mediates this Game (`games.get`'s membership flag). */
  mediator?: boolean
  /** The page's controls (`Roster`'s), after the way into Play: a fragment, one item each. */
  controls?: ReactNode
  /** A player's chip button, right of the name (`LaunchPlay`); the Mediator's is the link above. */
  actions?: ReactNode
}) {
  const mediates = mediator && gameId !== null
  return (
    <ChapterBand
      tone="crawler"
      fill={tokens.color.crawlerBand}
      measure={GAME_MEASURE}
      id="game-band-heading"
      asideAt="controls"
      aside={
        mediates || actions || controls ? (
          <>
            {mediates && (
              // The stamp and its link wrap as one piece, centred on each other.
              <Cluster gap={8}>
                <Badge shape="stamp" size="compact">
                  You mediate
                </Badge>
                <AppLink
                  href={`/play/game/${gameId}`}
                  className={buttonVariants({ variant: 'primary', size: 'compact' })}
                >
                  Mediate
                </AppLink>
              </Cluster>
            )}
            {actions}
            {controls}
          </>
        ) : undefined
      }
    >
      {name}
    </ChapterBand>
  )
}
