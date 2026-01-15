import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const GamesGrid = lazy(() =>
  import('../../../components/Dashboard/GamesGrid').then((m) => ({ default: m.GamesGrid }))
)

export const Route = createFileRoute('/dashboard/games/')({
  component: GamesGrid,
  staticData: {
    ssr: false,
  },
})
