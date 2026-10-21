/**
 * PublicSheetView — the `/p/$kind/$appId` page body, minus the router.
 *
 * Lives here rather than in the route file so that file exports nothing but
 * `Route`: any other export stops TanStack Router's `autoCodeSplitting` from
 * moving the route component out of the entry chunk, which is how
 * `PublicSheet` and the whole sheet tree it renders ended up downloaded on
 * every route. Tests render it directly.
 *
 * A saved mech pattern joins the route as `/p/pattern/:appId`: its own
 * query and its own page (`PublicPattern`), the same "not available" for
 * anything the reader may not see. A built NPC is `/p/npc/:appId`: the sheets'
 * query, drawn as its own read-only page (`NpcSheet`).
 *
 * The address segment is a short address (`shareAddress`) or a full app id;
 * every answer carries the full one, which is what the page reads by. Once it
 * resolves, `onAddress` is handed the current `<name>-<short id>` when the
 * address differs, so an old link or a renamed thing settles on its own.
 */

import { useQuery } from 'convex/react'
import type { SheetKind } from 'game-domain/entityKinds'
import { isSheetKind } from 'game-domain/entityKinds'
import { NpcSchema } from 'game-domain/schemas/npc'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import { shareSegment } from 'game-domain/shareAddress'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { PublicPattern } from '../mech/Pattern/PublicPattern'
import { NpcSheet } from '../npc/NpcSheet'
import { PublicSheet } from './PublicSheet'
import { SheetSkeleton } from './SheetSkeleton'

function NotAvailable({ what = 'sheet' }: { what?: 'sheet' | 'pattern' | 'NPC' }) {
  return (
    <NotFoundPanel
      title={`This ${what} isn’t available`}
      message="The link may be wrong, or its owner may have stopped sharing it."
    />
  )
}

/** Told the thing's current address segment when the one in the URL is not it. */
type OnAddress = (segment: string) => void

type QueryProps = { appId: string; onAddress?: OnAddress | undefined }

/** The name a body carries, for the readable half of its address. */
function nameOf(body: unknown): string | undefined {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : undefined
}

/**
 * Hand `onAddress` the resolved thing's own segment once, when the URL's
 * `segment` is not already it: an old full-id link, or a name since changed.
 */
function useCanonicalAddress(
  segment: string,
  resolved: { appId: string; body: unknown } | null | undefined,
  onAddress: OnAddress | undefined
) {
  const canonical = resolved ? shareSegment(resolved.appId, nameOf(resolved.body)) : null
  useEffect(() => {
    if (canonical !== null && canonical !== segment) onAddress?.(canonical)
  }, [canonical, segment, onAddress])
}

/** The half that talks to Convex, reached only with a known kind. */
function PublicSheetQuery({ kind, appId, onAddress }: QueryProps & { kind: SheetKind }) {
  const result = useQuery(api.publicSheet.get, { kind, appId })
  useCanonicalAddress(appId, result, onAddress)

  // `undefined` is Convex's "still loading"; `null` is a real "no such public
  // sheet". Collapsing them would flash the not-found page on every load.
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable />

  return <PublicSheet appId={result.appId} answer={result} />
}

/** A saved pattern: readable by link, by its Game's crew, or by its maker. */
function PublicPatternQuery({ appId, onAddress }: QueryProps) {
  const result = useQuery(api.publicSheet.pattern, { appId })
  useCanonicalAddress(appId, result, onAddress)
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable what="pattern" />

  // The body is `v.any()` on the server; parse it as every reader does.
  const parsed = MechPatternSchema.safeParse(result.body)
  if (!parsed.success) return <NotAvailable what="pattern" />
  return <PublicPattern answer={{ ...result, pattern: parsed.data }} />
}

/** A built NPC someone shared by link: its own page, read-only and credited to its maker. */
function PublicNpcQuery({ appId, onAddress }: QueryProps) {
  const result = useQuery(api.publicSheet.get, { kind: 'npc', appId })
  useCanonicalAddress(appId, result, onAddress)
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable what="NPC" />

  // The body is `v.any()` on the server; parse it as every reader does.
  const parsed = NpcSchema.safeParse(result.body)
  if (!parsed.success) return <NotAvailable what="NPC" />
  return (
    <NpcSheet
      npc={{ ...parsed.data, id: result.appId }}
      madeBy={result.madeBy ?? 'a player'}
      readOnly
      readOnlyNote="A shared NPC, read-only. Only whoever made it can change it."
    />
  )
}

/**
 * Everything the route decides, minus the router. Exported so a test can
 * render it directly rather than through a `RouterProvider`.
 */
export function PublicSheetView({
  kind,
  appId,
  onAddress,
}: {
  kind: string
  appId: string
  onAddress?: OnAddress
}) {
  if (kind === 'pattern') return <PublicPatternQuery appId={appId} onAddress={onAddress} />
  if (kind === 'npc') return <PublicNpcQuery appId={appId} onAddress={onAddress} />
  // A hand-typed path earns an explanation and a way back, not a validation
  // error from the server.
  if (!isSheetKind(kind)) return <NotAvailable />

  return <PublicSheetQuery kind={kind} appId={appId} onAddress={onAddress} />
}
