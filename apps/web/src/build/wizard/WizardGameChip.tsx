import { useQuery } from 'convex/react'
import { gamePath } from 'game-domain/entityKinds'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { relation, Tags } from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'

/**
 * The Game a wizard was started for (`?game=<id>`, ADR-052 §3), on its head:
 * the relation chip `GAME | Rust Run` (`chips-and-actions.md` C11), its value
 * linking to the Game's page in Play (a Game has no Peek). Nothing until the
 * Game is known, and nothing for a Game the player cannot see.
 */
export function WizardGameChip({ gameId }: { gameId: string }) {
  const { mode } = useConnection()
  const game = useQuery(
    api.games.get,
    mode === 'connected' ? { gameId: gameId as Id<'games'> } : 'skip'
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
