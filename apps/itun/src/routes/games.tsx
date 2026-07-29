import { createFileRoute } from '@tanstack/react-router'

import { GamesScreen } from '../components/games/GamesScreen'

export const Route = createFileRoute('/games')({
  component: GamesScreen,
})
