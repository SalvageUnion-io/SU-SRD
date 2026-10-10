import { createFileRoute, useParams } from '@tanstack/react-router'
import { InviteScreen } from '../../components/games/InviteScreen'
import { pageTitle } from '../../lib/pageTitle'

/**
 * `/invite/$token` — an invite link (issue 1255). `?join=1` marks the return from
 * "Sign in to join", so the page joins on arrival rather than asking again.
 */
export const Route = createFileRoute('/invite/$token')({
  head: () => ({ meta: [{ title: pageTitle('Join a Game') }] }),
  validateSearch: (search: Record<string, unknown>): { join?: true } =>
    search.join === 1 || search.join === '1' || search.join === true ? { join: true } : {},
  component: InviteRoute,
})

function InviteRoute() {
  const { token } = useParams({ from: '/invite/$token' })
  const { join } = Route.useSearch()
  return <InviteScreen token={token} joinOnArrival={join === true} />
}
