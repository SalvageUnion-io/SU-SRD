import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'

export const Route = createFileRoute('/_authenticated/games/$gameId/')({
  pendingComponent: PageSkeleton,
})
