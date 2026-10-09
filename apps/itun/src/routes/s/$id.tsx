/**
 * /s/$id — an old snapshot share link (ADR-036). Snapshots are retired: the
 * page reads nothing and says so, pointing the holder at the live public
 * sheet (ADR-032), which is how sheets are shared.
 */

import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { pageTitle } from '../../lib/pageTitle'

export const Route = createFileRoute('/s/$id')({
  head: () => ({ meta: [{ title: pageTitle('Retired link') }] }),
  component: RetiredShareLink,
})

function RetiredShareLink() {
  return (
    <NotFoundPanel
      title="This share link has been retired"
      message={
        <>
          Snapshot links no longer show a sheet. If someone sent you this one, ask them to share
          their live public sheet instead — that link stays up to date as they play.
        </>
      }
    />
  )
}
