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
import { SheetSkeleton } from 'component-lib'
import { cn } from '../../../lib/utils'
import type { EntityRef } from '../../../lib/schemas/entity'

/**
 * A sheet kind is exactly a store-entity kind. Partners are NOT among them:
 * one renders in place on its host's sheet as a decorated reference entity, so
 * it never needed a route, and `EntityRef` never needed widening (ADR-028).
 */
type SheetKind = EntityRef['type']

const VALID_KINDS: SheetKind[] = ['pilot', 'mech', 'crawler']

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
          &ldquo;{params.kind}&rdquo; is not a sheet type. Sheets exist for pilots, mechs, and
          crawlers.
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

  return <Sheet kind={kind} id={id} />
}
