/**
 * /crawlers/$id — minimal crawler detail route.
 *
 * Hydrates entityStore on load, reads the crawler by id.
 * Renders: name, tech level, bay summary, and incoming pilot-to-crawler SoftLinks.
 * Links to the sheet view (cycle-1) and back to dashboard.
 *
 * 404 rendered inline when the crawler is not found after hydration.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { cn } from '../../lib/utils'

export const Route = createFileRoute('/crawlers/$id')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('crawler'),
      useEntityStore.getState().hydrate('pilot'),
      useEntityStore.getState().hydrate('softLink'),
      useWorkspaceStore.getState().hydrate(),
    ])
    return { id: params.id }
  },
  component: CrawlerDetailPage,
})

function CrawlerDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const crawler = useEntityStore((s) => s.crawlers.find((c) => c.id === id) ?? null)
  const pilots = useEntityStore((s) => s.pilots)
  const { incoming } = useSoftLinks({ entityType: 'crawler', entityId: id })

  // Incoming pilot-to-crawler links — pilots assigned to this crawler
  const assignedPilotLinks = incoming.filter((l) => l.type === 'pilot-to-crawler')
  const assignedPilots = assignedPilotLinks.map((link) => ({
    link,
    pilot: pilots.find((p) => p.id === link.from.id) ?? null,
  }))

  if (!crawler) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-muted-foreground">Crawler not found.</p>
        <a href="/" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{crawler.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tech level: {crawler.techLevel}</p>
        </div>
        <a
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          Back
        </a>
      </div>

      {/* Summary */}
      <section className="mb-6 rounded-md border border-border p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex gap-2">
            <dt className="font-medium">Bay slots used:</dt>
            <dd>{crawler.bays.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Systems:</dt>
            <dd>{crawler.systems.length}</dd>
          </div>
        </dl>
      </section>

      {/* Assigned pilots (via incoming SoftLinks) */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Assigned Pilots</h2>
        {assignedPilots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pilots assigned. Pilots can be assigned from their detail page.
          </p>
        ) : (
          <ul className="space-y-2">
            {assignedPilots.map(({ link, pilot }) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex-1">
                  {pilot ? (
                    <a
                      href={`/pilots/${pilot.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {pilot.name}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Unknown pilot ({link.from.id})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Workspace assignment */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Workspace</h2>
        <AssignToWorkspaceButton
          entityType="crawler"
          entityId={id}
          currentWorkspaceId={crawler.workspaceId}
          onChanged={() => void navigate({ to: '/crawlers/$id', params: { id } })}
        />
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/sheet/crawler/${id}`}
          className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}
        >
          View Sheet
        </a>
      </div>
    </main>
  )
}
