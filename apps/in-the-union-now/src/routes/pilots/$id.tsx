/**
 * /pilots/$id — minimal pilot detail route.
 *
 * Hydrates entityStore on load, reads the pilot by id.
 * Renders: name, callsign, class ref, wiring affordances (assign to crawler).
 * Links to the sheet view (cycle-1) and back to dashboard.
 *
 * 404 rendered inline when the pilot is not found after hydration.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useEntityStore } from '../../stores/entityStore'
import { AssignCrawlerToPilot } from '../../components/wiring/AssignCrawlerToPilot'
import { UnassignLinkButton } from '../../components/wiring/UnassignLinkButton'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { cn } from '../../lib/utils'
import { PilotSheet } from '../../components/sheet/PilotSheet'
import { ExportEntityButton } from '../../components/export/ExportEntityButton'

export const Route = createFileRoute('/pilots/$id')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('pilot'),
      useEntityStore.getState().hydrate('crawler'),
      useEntityStore.getState().hydrate('softLink'),
      useWorkspaceStore.getState().hydrate(),
    ])
    return { id: params.id }
  },
  component: PilotDetailPage,
})

function PilotDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const pilot = useEntityStore((s) => s.pilots.find((p) => p.id === id) ?? null)
  const { outgoing } = useSoftLinks({ entityType: 'pilot', entityId: id })

  // Outgoing pilot-to-crawler links
  const crawlerLink = outgoing.find((l) => l.type === 'pilot-to-crawler') ?? null

  if (!pilot) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-muted-foreground">Pilot not found.</p>
        <a href="/" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{pilot.name}</h1>
          {pilot.callsign && (
            <p className="mt-0.5 text-sm text-muted-foreground">&ldquo;{pilot.callsign}&rdquo;</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">Class: {pilot.classRef}</p>
        </div>
        <a
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          Back
        </a>
      </div>

      {/* 2-pane at lg+: left = sheet/summary, right = wiring/actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left pane — summary + sheet */}
        <div className="min-w-0 flex-1">
          {/* Summary */}
          <section className="mb-6 rounded-md border border-border p-4 text-sm">
            <dl className="space-y-2">
              {pilot.conditions.length > 0 && (
                <div className="flex gap-2">
                  <dt className="font-medium">Conditions:</dt>
                  <dd>{pilot.conditions.join(', ')}</dd>
                </div>
              )}
              {pilot.motto && (
                <div className="flex gap-2">
                  <dt className="font-medium">Motto:</dt>
                  <dd>{pilot.motto}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Abilities + Equipment via the SRD entity display */}
          <section className="mb-6">
            <PilotSheet pilot={pilot} />
          </section>
        </div>

        {/* Right pane — wiring + actions */}
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          {/* Crawler assignment */}
          <section className="rounded-md border border-border p-4">
            <h2 className="mb-3 text-base font-semibold">Crawler</h2>
            {crawlerLink ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-muted-foreground">
                  Crawler linked:{' '}
                  <span className="font-medium text-foreground">{crawlerLink.to.id}</span>
                </span>
                <UnassignLinkButton
                  linkId={crawlerLink.id}
                  label="Unassign Crawler"
                  onUnassigned={() => void navigate({ to: '/pilots/$id', params: { id } })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">No crawler assigned.</p>
                <AssignCrawlerToPilot
                  pilotId={id}
                  onAssigned={() => void navigate({ to: '/pilots/$id', params: { id } })}
                />
              </div>
            )}
          </section>

          {/* Workspace assignment */}
          <section className="rounded-md border border-border p-4">
            <h2 className="mb-3 text-base font-semibold">Workspace</h2>
            <AssignToWorkspaceButton
              entityType="pilot"
              entityId={id}
              currentWorkspaceId={pilot.workspaceId}
              onChanged={() => void navigate({ to: '/pilots/$id', params: { id } })}
            />
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`/sheet/pilot/${id}`}
              className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}
            >
              View Sheet
            </a>
            <ExportEntityButton type="pilot" id={id} name={pilot.name} />
          </div>
        </div>
      </div>
    </main>
  )
}
