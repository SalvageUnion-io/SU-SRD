/**
 * Sheet view route — /sheet/:kind/:id
 *
 * kind: 'pilot' | 'mech' | 'crawler'
 * id:   entity id stored in entityStore
 *
 * The loader hydrates the entity store for all kinds and SoftLinks so
 * composition mode resolution (and linked-entity rails) works synchronously
 * in Sheet.tsx.
 *
 * Unknown kinds throw TanStack's notFound() and render the styled
 * SheetKindNotFound component (plan 2.8) instead of an unstyled router error.
 */

import { createFileRoute, notFound } from '@tanstack/react-router'
import { buttonVariants } from 'component-lib'

import { useEntityStore } from '../../../stores/entityStore'
import { AppLink } from '../../../components/shared/AppLink'
import { Sheet } from '../../../components/sheet/Sheet'
import { PartnerSheetPage } from '../../../components/sheet/PartnerSheetPage'
import { SheetSkeleton } from 'component-lib'
import { cn } from '../../../lib/utils'
import type { EntityRef } from '../../../lib/schemas/entity'

/**
 * Sheet kinds are ENTITY kinds plus `partner`, which is deliberately not an
 * `EntityRef['type']`: a partner lives on its host rather than in a store, so
 * widening `EntityRef` would ripple into SoftLink, snapshots and export bundles
 * for something that can never be either end of a link. The route is the only
 * place the two vocabularies meet.
 */
type SheetKind = EntityRef['type'] | 'partner'

const VALID_KINDS: SheetKind[] = ['pilot', 'mech', 'crawler', 'partner']

/** Route-param guard: narrows the raw `$kind` segment to a sheet kind. */
function isSheetKind(kind: string): kind is SheetKind {
  return VALID_KINDS.some((k) => k === kind)
}

function SheetKindNotFound() {
  const params = Route.useParams()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
      <div className="flex w-full max-w-xl flex-col items-start gap-4 rounded-[6px] border-chrome border-ink bg-paper p-6 sm:p-8">
        <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
          Sheet not found
        </h1>
        <p className="font-body text-sm text-wk-muted">
          &ldquo;{params.kind}&rdquo; is not a sheet type. Sheets exist for pilots, mechs, crawlers,
          and their partners.
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

export const Route = createFileRoute('/sheet/$kind/$id')({
  loader: async ({ params }) => {
    if (!isSheetKind(params.kind)) {
      throw notFound()
    }
    const store = useEntityStore.getState()
    // Hydrate ALL entity kinds (not just the viewed one): wired compositions
    // resolve linked entities (rail chips, Hold ← Load targets) from the
    // other kinds' stores via SoftLinks.
    await Promise.all([
      store.hydrate('pilot'),
      store.hydrate('mech'),
      store.hydrate('crawler'),
      store.hydrate('softLink'),
    ])
  },
  component: SheetPage,
  pendingComponent: SheetSkeleton,
  notFoundComponent: SheetKindNotFound,
})

function SheetPage() {
  const { kind, id } = Route.useParams()
  // The loader already 404s unknown kinds; this re-narrow keeps it cast-free.
  if (!isSheetKind(kind)) return <SheetKindNotFound />

  // A partner is not a store entity, so it does not go through `Sheet` (which
  // resolves a composition, a change log, an export and a workspace — none of
  // which a partner has). It gets its own shell over the same LiveSheet.
  if (kind === 'partner') return <PartnerSheetPage id={id} />

  return <Sheet kind={kind} id={id} />
}
