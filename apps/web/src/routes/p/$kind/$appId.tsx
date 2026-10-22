import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { useCallback } from 'react'
import { PublicSheetView } from '../../../build/sheet/PublicSheetView'
import { areaTitle } from '../../../lib/pageTitle'

/**
 * `/p/$kind/$appId` — one published sheet, readable with no account
 * ([ADR-032](../../../../docs/adr/032-public-read-only-sheets.md)).
 *
 * Addressed by the **app id**, not the Convex row id, so the owner can build
 * this URL with no round trip and the Discord bot can build it from the `appId`
 * it is already sent. The segment is its short form, `<name>-<short id>`
 * (`game-domain/shareAddress`), or a full app id from an older link; the page
 * replaces either with the thing's current short form once it resolves. The query is deliberately unauthenticated; what makes
 * that safe is that it serves nothing unless the owner set `publicRead`.
 *
 * A non-public sheet and a nonexistent one are the same page on purpose —
 * "this exists but is private" is itself a disclosure.
 *
 * `kind` is `pilot`, `mech`, `crawler` or `npc` — or `pattern`, a saved mech
 * pattern its maker shared. `PublicSheetView` routes a pattern and
 * an NPC to their own pages.
 *
 * The page body is `PublicSheetView` (`build/sheet/PublicSheetView.tsx`).
 * This file exports only `Route` so `autoCodeSplitting` can keep the sheet
 * tree out of the entry chunk (see `routes/__tests__/routeExports.test.ts`).
 */
export const Route = createFileRoute('/p/$kind/$appId')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Shared sheet') }] }),
  component: PublicSheetRoute,
})

function PublicSheetRoute() {
  const { kind, appId } = useParams({ from: '/p/$kind/$appId' })
  const navigate = useNavigate()
  const settle = useCallback(
    (segment: string) =>
      void navigate({ to: '/p/$kind/$appId', params: { kind, appId: segment }, replace: true }),
    [navigate, kind]
  )
  return <PublicSheetView kind={kind} appId={appId} onAddress={settle} />
}
