/**
 * /s/$id — an old snapshot share link (ADR-036). Snapshots are retired: the
 * page reads nothing and says so, pointing the holder at the live public
 * sheet (ADR-032), which is how sheets are shared.
 */

import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { pageTitle } from '../../lib/pageTitle'
import { routesSCopy } from '../../messages/routes-s'

export const Route = createFileRoute('/s/$id')({
  head: () => ({ meta: [{ title: pageTitle('Retired link') }] }),
  component: RetiredShareLink,
})

function RetiredShareLink() {
  return (
    <NotFoundPanel
      title={routesSCopy('thisShareLinkHasBeen')}
      message={routesSCopy('snapshotLinksNoLongerShow')}
    />
  )
}
