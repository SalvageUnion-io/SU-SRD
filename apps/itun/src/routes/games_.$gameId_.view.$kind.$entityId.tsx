import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The retired crew view — `/games/$gameId/view/$kind/$rowId` — now the live
 * sheet's address.
 *
 * A crewmate's sheet opened here, frozen and separate from the editable one.
 * There is one sheet now (`/sheet/$kind/$id`, `SheetView`): editable when it is
 * yours, read-only and live when it is not. The old URL still sits in Discord
 * replies (the bot's `gameSheetUrl`) and bookmarks, so it redirects, replacing
 * the history entry.
 *
 * It carries the Convex **row** id, not the app id every other link uses. The
 * sheet route accepts either — `entities.locate` resolves a row id — and puts
 * the canonical app id back in the bar. The Game id is not needed: a row id
 * names one row, wherever it lives.
 *
 * The trailing `_` on BOTH `games_` and `$gameId_` keeps this route out of the
 * lobby's and the crew roster's layouts, neither of which renders an Outlet.
 */
export const Route = createFileRoute('/games_/$gameId_/view/$kind/$entityId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/sheet/$kind/$id',
      params: { kind: params.kind, id: params.entityId },
      replace: true,
    })
  },
})
