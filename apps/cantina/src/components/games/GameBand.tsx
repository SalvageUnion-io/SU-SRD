/**
 * GameBand — the head of a Game's own page (board M2), drawn the way Shelves
 * draws its own: a full-width chapter band whose row keeps the SRD's 75rem
 * measure, the page's controls on the band above the title, and the Game's
 * name notched into its foot as the page's `h1`. The band is the crawler's
 * pink, because a Game is the crew and its Union Crawler; the deeper
 * `crawlerBand`, since its controls are paper (the book's crawler pink carries
 * neither ink nor paper at 4.5 : 1).
 *
 * For the Game's Mediator the band carries a **YOU MEDIATE** stamp and **Open
 * the Mediator dashboard**, the way into `/mediator/$gameId`
 * (docs/architecture/mediator-dashboard.md Q10). Everyone else sees the name.
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
}: {
  gameId: string | null
  /** The Game's name; "Game" while it loads. */
  name: string
  /** The viewer mediates this Game (`games.get`'s membership flag). */
  mediator?: boolean
  /** The page's controls, on the band above the title (`Roster`'s). */
  controls?: ReactNode
}) {
  return (
    <ChapterBand
      tone="crawler"
      fill={tokens.color.crawlerBand}
      measure={GAME_MEASURE}
      id="game-band-heading"
      eyebrow={controls}
      aside={
        mediator && gameId !== null ? (
          <>
            <Badge shape="stamp" size="compact">
              You mediate
            </Badge>
            <AppLink
              href={`/mediator/${gameId}`}
              className={buttonVariants({ variant: 'primary', size: 'compact' })}
            >
              Open the Mediator dashboard
            </AppLink>
          </>
        ) : undefined
      }
    >
      {name}
    </ChapterBand>
  )
}
