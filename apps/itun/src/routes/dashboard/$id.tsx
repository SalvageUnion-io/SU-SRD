/**
 * Dashboard route — /dashboard/:id
 *
 * id: a mech entity id in entityStore. The Dashboard runs a mech at the table
 * (see docs/architecture/play-cockpit.md). The loader hydrates all entity
 * kinds + SoftLinks so linked entities (pilot, crawler) resolve synchronously,
 * mirroring the sheet route.
 *
 * Phase 1: read-only shell. Later phases add the instruments, dial, and display.
 */

import { createFileRoute } from '@tanstack/react-router'

import { useEntityStore } from '../../stores/entityStore'
import { Dashboard } from '../../components/dashboard/Dashboard'
// The instrument stylesheet now lives in component-lib and loads with
// DashboardCanvas (see component-lib .../dashboard/instruments.css) — the app
// holds no bespoke dashboard CSS.

export const Route = createFileRoute('/dashboard/$id')({
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
  const { id } = Route.useParams()
  return <Dashboard id={id} />
}
