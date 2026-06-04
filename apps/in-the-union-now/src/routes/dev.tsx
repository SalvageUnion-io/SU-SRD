/**
 * THROWAWAY DEV SCAFFOLD — Slice G (#239).
 *
 * /dev — a dev-only flow index. Offers a "Seed sample data" button and links to
 * every major flow so a human can run `bun run dev:itun`, open /dev, seed, and
 * click through everything (dashboard, pilot/mech/crawler create + the seeded
 * sheets, and the snapshot publish flow).
 *
 * PRODUCTION EXCLUSION:
 *   The whole interactive body is gated behind `import.meta.env.DEV`. Vite
 *   statically replaces that with `false` in `vite build`, so the dev branch —
 *   and its dynamic imports of `../../scaffold/seed` and `../../scaffold/seedIds`
 *   — is dead-code-eliminated from the production bundle. In prod the route
 *   renders a bare "not available" stub. The throwaway `scaffold/` code
 *   (including the trivial seed-id constants) is therefore never shipped.
 *
 * >>> REMOVAL NOTE (delete before #239 merges): delete this file and the
 * >>> top-level `scaffold/` directory together.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { buttonVariants } from '../components/ui/buttonVariants'
import { cn } from '../lib/utils'

export const Route = createFileRoute('/dev')({
  component: DevFlowIndexPage,
})

type Flow = { label: string; href: string; note?: string }

function DevFlowIndexPage() {
  const [status, setStatus] = useState<string>('')
  const [seeding, setSeeding] = useState(false)
  const [flows, setFlows] = useState<Flow[]>([])

  // Production guard: this branch is eliminated by Vite (`import.meta.env.DEV`
  // → false) so neither the seed dynamic imports nor the UI ships.
  // The hooks above run unconditionally to satisfy the rules-of-hooks; in prod
  // the early return below still strips the dynamic `scaffold/` imports.

  // Stable seed ids are loaded via a DEV-only dynamic import so even the trivial
  // constant module is dead-code-eliminated from the production bundle.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let cancelled = false
    void import('../../scaffold/seedIds').then(({ SEED_IDS }) => {
      if (cancelled) return
      setFlows([
        { label: 'Dashboard', href: '/' },
        { label: 'Pilot — create wizard', href: '/pilots/new' },
        { label: 'Pilot — seeded detail', href: `/pilots/${SEED_IDS.pilot}` },
        { label: 'Pilot — seeded SHEET', href: `/sheet/pilot/${SEED_IDS.pilot}` },
        { label: 'Mech — create wizard', href: '/mechs/new' },
        { label: 'Mech — seeded detail', href: `/mechs/${SEED_IDS.mech}` },
        { label: 'Mech — seeded SHEET', href: `/sheet/mech/${SEED_IDS.mech}` },
        { label: 'Crawler — create wizard', href: '/crawlers/new' },
        { label: 'Crawler — seeded detail', href: `/crawlers/${SEED_IDS.crawler}` },
        { label: 'Crawler — seeded SHEET', href: `/sheet/crawler/${SEED_IDS.crawler}` },
        {
          label: 'Snapshot view (s/$id)',
          href: '/s/seed-not-published',
          note: 'Publish a snapshot from any seeded sheet first, then open the share URL.',
        },
      ])
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!import.meta.env.DEV) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-xl font-bold">Not available</h1>
        <p className="text-sm text-muted-foreground">
          The dev flow index is only available in development builds.
        </p>
      </main>
    )
  }

  async function handleSeed() {
    setSeeding(true)
    setStatus('Seeding…')
    try {
      // Dynamic import keeps the throwaway scaffold out of the prod bundle.
      const { seedSampleData } = await import('../../scaffold/seed')
      const result = await seedSampleData()
      setStatus(
        `Seeded ✓  pilot=${result.pilotId}  mech=${result.mechId}  crawler=${result.crawlerId}`
      )
    } catch (err) {
      setStatus(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="font-cond text-2xl font-bold uppercase tracking-wide text-su-black">
          Dev Flow Index
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Throwaway scaffold (#239). Seed the sample set, then click through every flow.
        </p>
      </header>

      <section className="mb-6 rounded-sm border border-su-black bg-white p-4">
        <button
          type="button"
          onClick={() => void handleSeed()}
          disabled={seeding}
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          {seeding ? 'Seeding…' : 'Seed sample data'}
        </button>
        {status && (
          <p
            className="mt-3 break-all font-mono text-xs text-su-ink-soft"
            data-testid="seed-status"
          >
            {status}
          </p>
        )}
      </section>

      <nav>
        <ul className="space-y-2">
          {flows.map((flow) => (
            <li key={flow.href}>
              <a
                href={flow.href}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'w-full justify-start no-underline'
                )}
              >
                {flow.label}
              </a>
              {flow.note && (
                <p className="ml-3 mt-0.5 text-xs text-muted-foreground">{flow.note}</p>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}

export default DevFlowIndexPage
