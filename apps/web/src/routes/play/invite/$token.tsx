import { createFileRoute, useParams } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from '../../../lib/pageTitle'
import { InviteScreen } from '../../../play/games/InviteScreen'

/**
 * `/play/invite/$token` — an invite link. `?join=1` marks the return from
 * "Sign in to join", so the page joins on arrival rather than asking again.
 */
export const Route = createFileRoute('/play/invite/$token')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play, 'Join a Game') }] }),
  validateSearch: (search: Record<string, unknown>): { join?: true } =>
    search.join === 1 || search.join === '1' || search.join === true ? { join: true } : {},
  component: InviteRoute,
})

function InviteRoute() {
  const { token } = useParams({ from: '/play/invite/$token' })
  const { join } = Route.useSearch()
  return <InviteScreen token={token} joinOnArrival={join === true} />
}
