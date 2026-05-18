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

export const Route = createFileRoute('/pilots/$id')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('pilot'),
      useEntityStore.getState().hydrate('crawler'),
      useEntityStore.getState().hydrate('softLink'),
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
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">Pilot not found.</p>
        <a href="/" className="text-sm text-primary underline-offset-2 hover:underline">
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{pilot.name}</h1>
          {pilot.callsign && (
            <p className="mt-0.5 text-sm text-muted-foreground">&ldquo;{pilot.callsign}&rdquo;</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">Class: {pilot.classRef}</p>
        </div>
        <a href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Back
        </a>
      </div>

      {/* Summary */}
      <section className="mb-6 rounded-md border border-border p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex gap-2">
            <dt className="font-medium">Abilities:</dt>
            <dd>{pilot.abilities.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Equipment:</dt>
            <dd>{pilot.equipment.length}</dd>
          </div>
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

      {/* Crawler assignment */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Crawler</h2>
        {crawlerLink ? (
          <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
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

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/sheet/pilot/${id}`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View Sheet
        </a>
      </div>
    </main>
  )
}
