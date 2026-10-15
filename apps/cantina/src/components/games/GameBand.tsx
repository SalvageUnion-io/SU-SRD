/**
 * GameBand — the head of a Game's own page (board M2), drawn the way Shelves
 * draws its own: a full-width chapter band whose row keeps the SRD's 75rem
 * measure, the page's controls on the band above the title, and the Game's
 * name notched into its foot as the page's `h1`. The band is the crawler's
 * pink, because a Game is the crew and its Union Crawler; the deeper
 * `crawlerBand`, since its controls are paper (the book's crawler pink carries
 * neither ink nor paper at 4.5 : 1).
 *
 * Every member gets one **Launch Dashboard** chip button. The Mediator's
 * carries a **YOU MEDIATE** stamp before it and opens the Mediator dashboard
 * (`/mediator/$gameId`, docs/architecture/mediator-dashboard.md Q10); a
 * player's is the hub's `actions`, which asks which pilot to play
 * (`LaunchDashboard`).
 */

import { Badge, buttonVariants, ChapterBand, tokens } from 'component-lib'
import type { ReactNode } from 'react'
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
  /** The page's controls, on the band above the title (`Roster`'s). */
  controls?: ReactNode
  /** A player's chip button, right of the name (`LaunchDashboard`); the Mediator's is the link above. */
  actions?: ReactNode
}) {
  const mediates = mediator && gameId !== null
  return (
    <ChapterBand
      tone="crawler"
      fill={tokens.color.crawlerBand}
      measure={GAME_MEASURE}
      id="game-band-heading"
      eyebrow={controls}
      aside={
        mediates || actions ? (
          <>
            {mediates && (
              <>
                <Badge shape="stamp" size="compact">
                  You mediate
                </Badge>
                <AppLink
                  href={`/mediator/${gameId}`}
                  className={buttonVariants({ variant: 'primary', size: 'compact' })}
                >
                  Launch Dashboard
                </AppLink>
              </>
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
