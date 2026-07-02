/**
 * /pilots/$id — minimal pilot detail route.
 *
 * Hydrates entityStore on load, reads the pilot by id.
 * Renders: name, callsign, class ref, wiring affordances (assign to crawler).
 * Links to the sheet view (cycle-1) and back to dashboard.
 *
 * 404 rendered inline when the pilot is not found after hydration.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { usePilot } from '../../hooks/queries'
import { useEntityStore } from '../../stores/entityStore'
import { AssignCrawlerToPilot } from '../../components/wiring/AssignCrawlerToPilot'
import { UnassignLinkButton } from '../../components/wiring/UnassignLinkButton'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { btnVariants } from 'suref-react'
import { cn } from '../../lib/utils'
import { PilotSheet } from '../../components/sheet/PilotSheet'
import { resolveClassName } from '../../lib/classRef'
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

  const pilot = usePilot(id)
  const { outgoing } = useSoftLinks({ entityType: 'pilot', entityId: id })

  // Outgoing pilot-to-crawler links
  const crawlerLink = outgoing.find((l) => l.type === 'pilot-to-crawler') ?? null

  if (!pilot) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-wk-muted">Pilot not found.</p>
        <Link to="/" className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cond text-2xl font-bold uppercase tracking-wide text-su-black">
            {pilot.name}
          </h1>
          {pilot.callsign && (
            <p className="mt-0.5 text-sm text-wk-muted">&ldquo;{pilot.callsign}&rdquo;</p>
          )}
          <p className="mt-1 font-cond text-xs font-semibold uppercase tracking-widest text-wk-muted">
            Class: {resolveClassName(pilot.classRef)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/pilots/$id/edit"
            params={{ id }}
            className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
          >
            Edit
          </Link>
          <Link
            to="/"
            className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
          >
            Back
          </Link>
        </div>
      </div>

      {/* 2-pane at lg+: left = sheet/summary, right = wiring/actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left pane — summary + sheet */}
        <div className="min-w-0 flex-1">
          {/* Summary */}
          {(pilot.conditions.length > 0 || pilot.motto) && (
            <section className="mb-6 rounded-[3px] border-chrome border-ink bg-paper p-4 text-sm">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
                Summary
              </h2>
              <dl className="space-y-2">
                {pilot.conditions.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                      Conditions:
                    </dt>
                    <dd>{pilot.conditions.join(', ')}</dd>
                  </div>
                )}
                {pilot.motto && (
                  <div className="flex gap-2">
                    <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                      Motto:
                    </dt>
                    <dd>{pilot.motto}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Abilities + Equipment via the SRD entity display */}
          <section className="mb-6">
            <PilotSheet pilot={pilot} />
          </section>
        </div>

        {/* Right pane — wiring + actions */}
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          {/* Crawler assignment */}
          <section className="rounded-[3px] border-chrome border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Crawler
            </h2>
            {crawlerLink ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-wk-muted">
                  Crawler linked: <span className="font-medium text-ink">{crawlerLink.to.id}</span>
                </span>
                <UnassignLinkButton
                  linkId={crawlerLink.id}
                  label="Unassign Crawler"
                  onUnassigned={() => void navigate({ to: '/pilots/$id', params: { id } })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-wk-muted">No crawler assigned.</p>
                <AssignCrawlerToPilot
                  pilotId={id}
                  onAssigned={() => void navigate({ to: '/pilots/$id', params: { id } })}
                />
              </div>
            )}
          </section>

          {/* Workspace assignment */}
          <section className="rounded-[3px] border-chrome border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Workspace
            </h2>
            <AssignToWorkspaceButton
              entityType="pilot"
              entityId={id}
              currentWorkspaceId={pilot.workspaceId}
              onChanged={() => void navigate({ to: '/pilots/$id', params: { id } })}
            />
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/sheet/$kind/$id"
              params={{ kind: 'pilot', id }}
              className={cn(btnVariants({ variant: 'primary' }), 'no-underline')}
            >
              View Sheet
            </Link>
            <ExportEntityButton type="pilot" id={id} name={pilot.name} />
          </div>
        </div>
      </div>
    </main>
  )
}
