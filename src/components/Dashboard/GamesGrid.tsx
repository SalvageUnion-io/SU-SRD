import { GameSmallDisplay } from './GameSmallDisplay'
import { GridLayout } from './GridLayout'
import { useUserGamesList } from '../../hooks/game/useGames'
import { useCreateEntity } from '../../hooks/useCreateEntity'
import { logger } from '../../lib/logger'

export function GamesGrid() {
  const { data: games, isLoading: loading, error, refetch: reload } = useUserGamesList()

  const { createEntity: createGame, isLoading: isCreating } = useCreateEntity({
    table: 'games',
    navigationPath: (id: string) => `/dashboard/games/${id}`,
  })

  const handleCreateGame = async () => {
    try {
      await createGame()
    } catch (err) {
      logger.error('Failed to create game:', err)
    }
  }

  return (
    <GridLayout<{ game_id: string; role: string }>
      title="Your Games"
      loading={loading}
      error={error?.message || null}
      items={games || []}
      renderItem={(game) => (
        <GameSmallDisplay
          key={game.game_id}
          id={game.game_id}
          to="/dashboard/games/$gameId"
          params={{ gameId: game.game_id }}
        />
      )}
      createButton={{
        onClick: handleCreateGame,
        label: 'New Game',
        bgColor: 'brand.srd',
        color: 'su.white',
        isLoading: isCreating,
      }}
      onRetry={reload}
      primarySectionLabel="Mediator Games"
      secondarySectionLabel="Member Games"
      getSectionType={(game) => (game.role === 'mediator' ? 'primary' : 'secondary')}
    />
  )
}
