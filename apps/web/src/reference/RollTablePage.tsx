/**
 * The roll-table page: a roll table is something you roll on, so
 * its page rolls. The page module renders this inside `EntityPageFrame` in
 * place of the entity card.
 *
 * Server-only (it digests the table at build time). The server renders the
 * island itself, from the same props, inside its placeholder, so the bands are
 * in the HTML for a crawler or a no-JS reader, and the island hydrates that
 * markup rather than drawing it again: React adopts the bands as they are and
 * only the roll stamp becomes a button (`RollTableInstrument`'s `useLive`).
 * The table is the shared `RollTableInstrument`, as in every card and guide;
 * a roll's result is a toast, as on every card.
 */

import { ColumnsTableIsland } from '../components/islands/ColumnsTableIsland'
import { RollTableIsland } from '../components/islands/RollTableIsland'
import type { ColumnsTablePageData } from '../lib/columnsTablePage'
import type { RollTablePageData } from '../lib/rollTablePage'
import { Island } from '../runtime/Island'

/**
 * A two-roll table's page: the column, then the entry (Callsign Table).
 * `tone` is the page's band colour, which the table's rows band in.
 */
export function ColumnsTablePage({ data, tone }: { data: ColumnsTablePageData; tone: string }) {
  return (
    <Island name="ColumnsTableIsland" client="idle" ssr hydrate props={{ data, tone }}>
      <ColumnsTableIsland data={data} tone={tone} />
    </Island>
  )
}

/** A banded d20 table's page; `tone` is the page's band colour, as above. */
export function RollTablePage({ data, tone }: { data: RollTablePageData; tone: string }) {
  return (
    <Island name="RollTableIsland" client="idle" ssr hydrate props={{ data, tone }}>
      <RollTableIsland data={data} tone={tone} />
    </Island>
  )
}
