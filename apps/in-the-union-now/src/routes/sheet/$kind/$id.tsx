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

import { useEntityStore } from '../../../stores/entityStore'
import { AppLink } from '../../../components/shared/AppLink'
import { Sheet } from '../../../components/sheet/Sheet'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import { cn } from '../../../lib/utils'
import type { EntityRef } from '../../../lib/schemas/entity'

const VALID_KINDS: EntityRef['type'][] = ['pilot', 'mech', 'crawler']

function SheetKindNotFound() {
  const params = Route.useParams()
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-xl font-bold">Sheet not found</h1>
      <p className="mb-4 text-sm text-wk-muted">
        &ldquo;{params.kind}&rdquo; is not a sheet type. Sheets exist for pilots, mechs, and
        crawlers.
      </p>
      <AppLink
        href="/"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
      >
        &larr; Back to dashboard
      </AppLink>
    </main>
  )
}

export const Route = createFileRoute('/sheet/$kind/$id')({
  loader: async ({ params }) => {
    const kind = params.kind as EntityRef['type']
    if (!VALID_KINDS.includes(kind)) {
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
  notFoundComponent: SheetKindNotFound,
})

function SheetPage() {
  const { kind, id } = Route.useParams()
  const entityKind = kind as EntityRef['type']

  return <Sheet kind={entityKind} id={id} />
}
