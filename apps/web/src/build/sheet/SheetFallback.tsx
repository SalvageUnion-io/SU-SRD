/**
 * SheetFallback — what a `/sheet/$kind/$id` page shows in place of a sheet
 * (`useLocatedSheet`), worded alike for every kind: still loading, not found,
 * unavailable offline, or a body this app cannot show.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
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
          title={`${name} not found`}
          message={`This ${name} may have been deleted, or the link may be stale.`}
          back={back}
        />
      )
    case 'offline':
      return (
        <NotFoundPanel
          title={`${name} unavailable offline`}
          message={`This ${name} was not loaded before the connection dropped, and loading it needs a connection.`}
        />
      )
    case 'unreadable':
      return (
        <NotFoundPanel
          title={`Could not show this ${name}`}
          message={`This ${name}’s data doesn’t match anything this app knows how to show. It may have been built in a newer version.`}
          back={back}
        />
      )
  }
}
