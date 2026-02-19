import { createFileRoute } from '@tanstack/react-router'
import { HydratedCrawlerDisplay } from '../../../../components/games/HydratedCrawlerDisplay'

export const Route = createFileRoute('/_authenticated/games/$gameId/crawler')({
  component: CrawlerDetailPage,
})

function CrawlerDetailPage() {
  const { gameId } = Route.useParams()
  return <HydratedCrawlerDisplay gameId={gameId} />
}
