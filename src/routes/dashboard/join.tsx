import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const JoinGame = lazy(() =>
  import('../../components/Dashboard/JoinGame').then((m) => ({ default: m.JoinGame }))
)

export const Route = createFileRoute('/dashboard/join')({
  component: JoinGame,
  staticData: {
    ssr: false,
  },
})
