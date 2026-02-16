import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/games/$gameId')({
  component: GameLayout,
})

function GameLayout() {
  return <Outlet />
}
