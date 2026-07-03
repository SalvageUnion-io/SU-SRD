/**
 * /crawlers/$id — minimal crawler detail route.
 *
 * Hydrates entityStore on load, reads the crawler by id.
 * Renders: name, tech level, bay summary, and incoming pilot-to-crawler SoftLinks.
 * Links to the sheet view (cycle-1) and back to dashboard.
 *
 * 404 rendered inline when the crawler is not found after hydration.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { useCrawler, usePilots } from '../../hooks/queries'
import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { btnVariants } from 'suref-react'
import { cn } from '../../lib/utils'
import { ExportEntityButton } from '../../components/export/ExportEntityButton'

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

  const crawler = useCrawler(id)
  const pilots = usePilots()
  const { incoming } = useSoftLinks({ entityType: 'crawler', entityId: id })

  // Incoming pilot-to-crawler links — pilots assigned to this crawler
  const assignedPilotLinks = incoming.filter((l) => l.type === 'pilot-to-crawler')
  const assignedPilots = assignedPilotLinks.map((link) => ({
    link,
    pilot: pilots.find((p) => p.id === link.from.id) ?? null,
  }))

  if (!crawler) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-wk-muted">Crawler not found.</p>
        <a href="/" className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cond text-2xl font-bold uppercase tracking-wide text-su-black">
            {crawler.name}
          </h1>
          <p className="mt-1 font-cond text-xs font-semibold uppercase tracking-widest text-wk-muted">
            Tech level: {crawler.techLevel}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/crawlers/$id/edit"
            params={{ id }}
            className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
          >
            Edit
          </Link>
          <a href="/" className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
            Back
          </a>
        </div>
      </div>

      {/* 2-pane at lg+: left = summary/stats, right = wiring/actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left pane — crawler stats summary */}
        <div className="min-w-0 flex-1">
          <section className="mb-6 rounded-[3px] border-chrome border-ink bg-paper p-4 text-sm">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Stats
            </h2>
            <dl className="grid grid-cols-2 gap-2">
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                  Bays:
                </dt>
                <dd>{(crawler.crawlerBays ?? []).length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                  Systems:
                </dt>
                <dd>{crawler.systems.length}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right pane — assigned pilots + workspace/actions */}
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          {/* Assigned pilots (via incoming SoftLinks) */}
          <section className="rounded-[3px] border-chrome border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Assigned Pilots
            </h2>
            {assignedPilots.length === 0 ? (
              <p className="text-sm text-wk-muted">
                No pilots assigned. Pilots can be assigned from their detail page.
              </p>
            ) : (
              <ul className="space-y-2">
                {assignedPilots.map(({ link, pilot }) => (
                  <li
                    key={link.id}
                    className="flex items-center gap-2 rounded-[3px] border-chrome border-ink px-3 py-2 text-sm"
                  >
                    <span className="flex-1">
                      {pilot ? (
                        <a
                          href={`/pilots/${pilot.id}`}
                          className="font-medium text-rust underline-offset-2 hover:underline"
                        >
                          {pilot.name}
                        </a>
                      ) : (
                        <span className="text-wk-muted">Unknown pilot ({link.from.id})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Workspace assignment */}
          <section className="rounded-[3px] border-chrome border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Workspace
            </h2>
            <AssignToWorkspaceButton
              entityType="crawler"
              entityId={id}
              currentWorkspaceId={crawler.workspaceId}
              onChanged={() => void navigate({ to: '/crawlers/$id', params: { id } })}
            />
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`/sheet/crawler/${id}`}
              className={cn(btnVariants({ variant: 'primary' }), 'no-underline')}
            >
              View Sheet
            </a>
            <ExportEntityButton type="crawler" id={id} name={crawler.name} />
          </div>
        </div>
      </div>
    </main>
  )
}
