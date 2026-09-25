import { createFileRoute, useParams } from '@tanstack/react-router'
import { PublicSheetView } from '../components/sheet/PublicSheetView'

/**
 * `/p/$kind/$appId` — one published sheet, readable with no account
 * ([ADR-032](../../../../docs/adrs/ADR-032-public-read-only-sheets.md)).
 *
 * Addressed by the **app id**, not the Convex row id, so the owner can build
 * this URL with no round trip and the Discord bot can build it from the `appId`
 * it is already sent. The query is deliberately unauthenticated; what makes
 * that safe is that it serves nothing unless the owner set `publicRead`.
 *
 * A non-public sheet and a nonexistent one are the same page on purpose —
 * "this exists but is private" is itself a disclosure.
 *
 * The page body is `PublicSheetView` (`components/sheet/PublicSheetView.tsx`).
 * This file exports only `Route` so `autoCodeSplitting` can keep the sheet
 * tree out of the entry chunk (see `routes/__tests__/routeExports.test.ts`).
 */
export const Route = createFileRoute('/p/$kind/$appId')({
  component: PublicSheetRoute,
})

function PublicSheetRoute() {
  const { kind, appId } = useParams({ from: '/p/$kind/$appId' })
  return <PublicSheetView kind={kind} appId={appId} />
}
