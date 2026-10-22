import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySurfaceValue } from '../index'
import { EntitySurfaceProvider, PeekHost, useDetailModal } from '../index'

/**
 * The app's PAGE OPENER and PEEK (entity display language E4, E5): the surface's
 * `openPage`, so a Mention or a Tag anywhere in the app opens its entity, and
 * the app's one `PeekHost`, so they Peek on hover, focus or long-press.
 *
 * The Page is the detail dialog
 * (`useDetailModal`). Every route renders inside `GameDataReady`, so the
 * entity a ref names is already loaded.
 */
export function EntityPageHost({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<RefEntity | undefined>(undefined)
  const detail = useDetailModal(entity, { forceModal: true })
  // The dialog's opener is a fresh closure each render; the surface reads the
  // latest through a ref, so it stays one stable value for every consumer.
  const openDetail = useRef(detail.control.onClick)
  useEffect(() => {
    openDetail.current = detail.control.onClick
  })
  const surface = useMemo<Partial<EntitySurfaceValue>>(
    () => ({
      openPage: (ref) => {
        const found = SalvageUnionReference.isLoaded(ref.schemaName)
          ? (SalvageUnionReference.get(ref.schemaName, ref.id) as RefEntity | undefined)
          : undefined
        if (!found) return
        setEntity(found)
        openDetail.current?.()
      },
    }),
    []
  )
  return (
    <EntitySurfaceProvider value={surface}>
      {children}
      {detail.modal}
      <PeekHost />
    </EntitySurfaceProvider>
  )
}
