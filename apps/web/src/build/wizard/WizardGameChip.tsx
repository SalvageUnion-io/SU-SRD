import { gamePath } from 'game-domain/entityKinds'
import { relation, Tag } from '../../components/index'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

/**
 * The Game a wizard was started for (`?game=<id>`, ADR-052 §3), on its head:
 * the relation chip `GAME | Rust Run` (`chips-and-actions.md` C11), its value
 * linking to the Game's page in Play (a Game has no Peek). Nothing until the
 * Game is known, and nothing for a Game the player cannot see. A Game's name
 * is never cut (R56): one longer than the page wraps inside the chip.
 */
export function WizardGameChip({ gameId }: { gameId: string }) {
  const { status } = useSync()
  const game = useGamesQuery('games.get', status === 'live' ? { gameId: gameId } : 'skip')
  if (!game) return null
  return (
    <Tag
      tag={relation('game', 'Game', game.name, { href: gamePath(gameId) })}
      linkable
      size="mini"
      wrap
    />
  )
}
