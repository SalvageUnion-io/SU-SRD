/**
 * The Training Bay's Crawlers shelf (`Shelves`): one line a crawler of yours,
 * and the crawler of each Game you run.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { ReactNode } from 'react'
import type { HeaderMenuItem } from '../../components/index'
import type { ShelfGame } from '../../lib/shelves/shelfItems'
import {
  crawlerChips,
  crawlerFact,
  crawlerReading,
  gameRelation,
  linkChip,
} from '../../lib/shelves/shelfItems'
import { VITAL } from '../../lib/units/readings'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { crawlerRailItems, rowStats } from '../sheet/railStats.model'
import { ShelfLedger } from './ShelfLedger'
import { CRAWLER_COLUMNS, inGame, read, under } from './shelfColumns'

type CrawlerShelfProps = {
  crawlers: Crawler[]
  games: ShelfGame[] | undefined
  sharedByLink: readonly string[] | undefined
  /** The shelf's + New, where a write could land. */
  action: ReactNode
  menu: (crawler: Crawler) => HeaderMenuItem[][]
  /** The row's Copy (r6 E9). */
  copy?: ((crawler: Crawler) => (() => void) | undefined) | undefined
}

export function CrawlerShelf({
  crawlers,
  games,
  sharedByLink,
  action,
  menu,
  copy,
}: CrawlerShelfProps) {
  return (
    <ShelfLedger
      id="shelf-crawlers"
      title={buildShelvesCopy('crawlers')}
      tone="crawler"
      columns={CRAWLER_COLUMNS}
      action={action}
      empty={buildShelvesCopy('noCrawlersYet')}
      rows={crawlers.map((c) => {
        const r = rowStats(crawlerRailItems(c))
        return {
          id: c.id,
          name: c.name,
          href: `/crawlers/${c.id}`,
          under: under([...crawlerChips({ crawler: c, games }), ...linkChip(sharedByLink, c.id)]),
          cells: [
            crawlerFact(c) ?? '',
            inGame(gameRelation(c, games)),
            String(crawlerReading(c).value),
            read(r, VITAL.sp),
          ],
          menu: menu(c),
          copy: copy?.(c),
        }
      })}
    />
  )
}
