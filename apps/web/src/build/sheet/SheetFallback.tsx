/**
 * SheetFallback — what a sheet page (`/pilots/$id`, …) shows in place of a sheet
 * (`useLocatedSheet`), worded alike for every kind: still loading, not found,
 * unavailable offline, or a body this app cannot show.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { buildSheetCopy } from '../../messages/build-sheet'
import { SheetSkeleton } from './SheetSkeleton'

/** The kind as the panels name it. */
const KIND_NAME: Record<EntityKind, string> = {
  pilot: 'pilot',
  mech: 'mech',
  crawler: 'crawler',
  npc: 'NPC',
}

export function SheetFallback({
  kind,
  status,
  back,
}: {
  kind: EntityKind
  status: 'loading' | 'missing' | 'offline' | 'unreadable'
  back?: { href: string; label: string } | undefined
}) {
  const name = KIND_NAME[kind]
  switch (status) {
    case 'loading':
      return <SheetSkeleton />
    case 'missing':
      // Styled, with an exit path: this is the most-visited surface in the
      // app, and a bare one-liner stranded the user.
      return (
        <NotFoundPanel
          title={buildSheetCopy('notFound', { name })}
          message={buildSheetCopy('thisMayHaveBeenDeleted', { name })}
          back={back}
        />
      )
    case 'offline':
      return (
        <NotFoundPanel
          title={buildSheetCopy('unavailableOffline', { name })}
          message={buildSheetCopy('thisWasNotLoadedBefore', { name })}
        />
      )
    case 'unreadable':
      return (
        <NotFoundPanel
          title={buildSheetCopy('couldNotShowThis', { name })}
          message={buildSheetCopy('thisSDataDoesntMatch', { name })}
          back={back}
        />
      )
  }
}
