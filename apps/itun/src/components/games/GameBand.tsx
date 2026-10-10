/**
 * GameBand — the head of a Game's own page (board M2, issue 1278): the Game's
 * name, notched into a crawler-pink chapter band, because a Game is the crew
 * and its Union Crawler.
 *
 * For the Game's Mediator the band carries a **YOU MEDIATE** stamp and **Open
 * the Mediator dashboard**, the way into `/mediator/$gameId`
 * (docs/architecture/mediator-dashboard.md Q10). Everyone else sees the name.
 */

import { Badge, buttonVariants, ChapterBand } from 'component-lib'
import { AppLink } from '../shared/AppLink'

export function GameBand({
  gameId,
  name,
  mediator,
}: {
  gameId: string
  name: string
  /** The viewer mediates this Game (`games.get`'s membership flag). */
  mediator: boolean
}) {
  return (
    <ChapterBand
      tone="crawler"
      as="h2"
      id="game-band-heading"
      aside={
        mediator ? (
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
