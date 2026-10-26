import { gamePath } from 'game-domain/entityKinds'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { relation, Tags } from '../../components/index'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

/**
 * The Game a wizard was started for (`?game=<id>`, ADR-052 §3), on its head:
 * the relation chip `GAME | Rust Run` (`chips-and-actions.md` C11), its value
 * linking to the Game's page in Play (a Game has no Peek). Nothing until the
 * Game is known, and nothing for a Game the player cannot see.
 */
export function WizardGameChip({ gameId }: { gameId: string }) {
  const { status } = useSync()
  const game = useGamesQuery(
    api.games.get,
    status === 'live' ? { gameId: gameId as Id<'games'> } : 'skip'
  )
  if (!game) return null
  return (
    <Tags
      tags={[relation('game', 'Game', game.name, { href: gamePath(gameId) })]}
      linkable
      size="mini"
    />
  )
}
