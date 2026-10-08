/**
 * Dashboard route — /dashboard/:pilotId
 *
 * The Dashboard runs one pilot in a Game that has a Mediator (ADR-038 §1;
 * docs/architecture/dashboard.md). An old mech-keyed URL lands here too and is
 * redirected to the mech's pilot.
 *
 * The loader only hydrates every entity kind and the soft links, mirroring the
 * sheet route, so the pilot and its mech and crawler resolve synchronously.
 * Who may play is not decided here: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), and the check has to stay live, so
 * `DashboardGate` decides it in the component. For the same reason the title
 * carries no pilot name.
 */

import { createFileRoute } from '@tanstack/react-router'
import { DashboardGate } from '../../components/dashboard/DashboardGate'
import { pageTitle } from '../../lib/pageTitle'
import { useEntityStore } from '../../stores/entityStore'

export const Route = createFileRoute('/dashboard/$pilotId')({
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  loader: async () => {
    const store = useEntityStore.getState()
    await Promise.all([
      store.hydrate('mech'),
      store.hydrate('pilot'),
      store.hydrate('crawler'),
      store.hydrate('softLink'),
    ])
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { pilotId } = Route.useParams()
  return <DashboardGate id={pilotId} />
}
