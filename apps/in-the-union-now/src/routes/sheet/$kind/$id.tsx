/**
 * Sheet view route — /sheet/:kind/:id
 *
 * kind: 'pilot' | 'mech' | 'crawler'
 * id:   entity id stored in entityStore
 *
 * The loader hydrates the entity store for the requested kind and all
 * SoftLinks so composition mode resolution works synchronously in Sheet.tsx.
 *
 * Click-to-edit stats are deferred to #199 (later wave).
 */

import { createFileRoute } from '@tanstack/react-router'

import { useEntityStore } from '../../../stores/entityStore'
import { Sheet } from '../../../components/sheet/Sheet'
import type { EntityRef } from '../../../lib/schemas/entity'

const VALID_KINDS: EntityRef['type'][] = ['pilot', 'mech', 'crawler']

export const Route = createFileRoute('/sheet/$kind/$id')({
  loader: async ({ params }) => {
    const kind = params.kind as EntityRef['type']
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Unknown sheet kind: ${params.kind}`)
    }
    const store = useEntityStore.getState()
    await Promise.all([store.hydrate(kind), store.hydrate('softLink')])
  },
  component: SheetPage,
})

function SheetPage() {
  const { kind, id } = Route.useParams()
  const entityKind = kind as EntityRef['type']

  return <Sheet kind={entityKind} id={id} />
}
