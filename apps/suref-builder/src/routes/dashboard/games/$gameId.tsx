import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const GameLiveSheet = lazy(() =>
  import('../../../components/Dashboard/GameLiveSheet').then((m) => ({ default: m.GameLiveSheet }))
)

export const Route = createFileRoute('/dashboard/games/$gameId')({
  component: GameLiveSheet,
  staticData: {
    ssr: false,
  },
})
