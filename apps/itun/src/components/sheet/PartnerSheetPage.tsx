/**
 * PartnerSheetPage — store wiring for `/sheet/partner/:id`.
 *
 * Split from `SheetPartner` so that component stays a pure render of a resolved
 * partner (the shape tests and snapshots want) while this one owns the lookup:
 * scanning pilots and mechs for the id, then finding the host pilot's crawler,
 * which is what a pilot-granted partner's tech level scales off.
 */

import { buttonVariants } from 'component-lib'

import { findPartner } from '../../lib/partnerLookup'
import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import { SheetPartner } from './SheetPartner'

export function PartnerSheetPage({ id }: { id: string }) {
  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  const softLinks = useEntityStore((s) => s.softLinks)

  const found = findPartner(pilots, mechs, id)

  if (!found) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
        <div className="flex w-full max-w-xl flex-col items-start gap-4 rounded-[6px] border-chrome border-ink bg-paper p-6 sm:p-8">
          <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
            Partner not found
          </h1>
          <p className="font-body text-sm text-wk-muted">
            A partner belongs to the pilot or mech that fields it, so it goes when they do. This
            one&rsquo;s owner may have been deleted, or the link may be stale.
          </p>
          <AppLink
            href="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
          >
            &larr; Back to Roster
          </AppLink>
        </div>
      </main>
    )
  }

  // Only a PILOT host needs a crawler: a mech-granted drone's tech level is
  // fixed by its stat block and never tracks the Union Crawler.
  const crawler =
    found.hostKind === 'pilot'
      ? (() => {
          const link = softLinks.find(
            (l) => l.type === 'pilot-to-crawler' && l.from.id === found.host.id
          )
          return link ? (crawlers.find((c) => c.id === link.to.id) ?? null) : null
        })()
      : null

  return <SheetPartner found={found} crawler={crawler} />
}
