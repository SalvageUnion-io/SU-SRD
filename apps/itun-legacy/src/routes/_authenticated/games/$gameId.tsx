import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ErrorFallback } from '../../../components/shared/ErrorFallback'

export const Route = createFileRoute('/_authenticated/games/$gameId')({
  errorComponent: ErrorFallback,
  component: GameLayout,
})

function GameLayout() {
  return <Outlet />
}
