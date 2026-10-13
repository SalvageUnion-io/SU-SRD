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
 */

import { buttonVariants, tokens } from 'component-lib'
import { PRODUCT } from 'component-lib/product'
import { useQuery } from 'convex/react'
import { NpcSchema } from 'itun-domain/schemas/npc'
import { MechPatternSchema } from 'itun-domain/schemas/pattern'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { PublicPattern } from '../mech/Pattern/PublicPattern'
import { NpcSheet } from '../npc/NpcSheet'
import { AppLink } from '../shared/AppLink'
import { PublicSheet } from './PublicSheet'
import { SheetSkeleton } from './SheetSkeleton'

const KINDS = ['pilot', 'mech', 'crawler'] as const
type PublicKind = (typeof KINDS)[number]

function isPublicKind(value: string): value is PublicKind {
  return (KINDS as readonly string[]).includes(value)
}

const NOT_AVAILABLE = {
  marginInline: 'auto',
  maxWidth: '64rem',
  padding: tokens.space[24],
} satisfies CSSProperties

const TITLE = {
  marginBottom: tokens.space[8],
  fontSize: tokens.fontSize.xl,
  lineHeight: 'calc(1.75 / 1.25)',
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const NOTE = {
  marginBottom: tokens.space[16],
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

function NotAvailable({ what = 'sheet' }: { what?: 'sheet' | 'pattern' | 'NPC' }) {
  return (
    <main style={NOT_AVAILABLE}>
      <h1 style={TITLE}>This {what} isn&rsquo;t available</h1>
      <p style={NOTE}>The link may be wrong, or its owner may have stopped sharing it.</p>
      <AppLink
        href="/"
        className={buttonVariants({ variant: 'ghost', size: 'compact' })}
        style={LINK}
      >
        &larr; {PRODUCT.name}
      </AppLink>
    </main>
  )
}

/** The half that talks to Convex, reached only with a known kind. */
function PublicSheetQuery({ kind, appId }: { kind: PublicKind; appId: string }) {
  const result = useQuery(api.publicSheet.get, { kind, appId })

  // `undefined` is Convex's "still loading"; `null` is a real "no such public
  // sheet". Collapsing them would flash the not-found page on every load.
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable />

  return <PublicSheet appId={appId} answer={result} />
}

/** A saved pattern: readable by link, by its Game's crew, or by its maker. */
function PublicPatternQuery({ appId }: { appId: string }) {
  const result = useQuery(api.publicSheet.pattern, { appId })
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable what="pattern" />

  // The body is `v.any()` on the server; parse it as every reader does.
  const parsed = MechPatternSchema.safeParse(result.body)
  if (!parsed.success) return <NotAvailable what="pattern" />
  return <PublicPattern answer={{ ...result, pattern: parsed.data }} />
}

/** A built NPC someone shared by link: its own page, read-only and credited to its maker. */
function PublicNpcQuery({ appId }: { appId: string }) {
  const result = useQuery(api.publicSheet.get, { kind: 'npc', appId })
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable what="NPC" />

  // The body is `v.any()` on the server; parse it as every reader does.
  const parsed = NpcSchema.safeParse(result.body)
  if (!parsed.success) return <NotAvailable what="NPC" />
  return (
    <NpcSheet
      npc={{ ...parsed.data, id: appId }}
      madeBy={result.madeBy ?? 'a player'}
      readOnly
      back={{ href: '/', label: PRODUCT.name }}
      readOnlyNote="A shared NPC, read-only. Only whoever made it can change it."
    />
  )
}

/**
 * Everything the route decides, minus the router. Exported so a test can
 * render it directly rather than through a `RouterProvider`.
 */
export function PublicSheetView({ kind, appId }: { kind: string; appId: string }) {
  if (kind === 'pattern') return <PublicPatternQuery appId={appId} />
  if (kind === 'npc') return <PublicNpcQuery appId={appId} />
  // A hand-typed path earns an explanation and a way back, not a validation
  // error from the server.
  if (!isPublicKind(kind)) return <NotAvailable />

  return <PublicSheetQuery kind={kind} appId={appId} />
}
