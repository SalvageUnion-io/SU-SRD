/**
 * CrawlerMinor — the Game's primary crawler on the Mediator Dashboard (board
 * M1; docs/architecture/mediator-dashboard.md Q6): its name on a crawler-pink
 * band, SP, its tech level and its bays intact as label-first `Stat` chips
 * (`BAYS | 10/10`), under
 * "Yours to edit: you run the table."
 *
 * The crawler is the Mediator's to run (ADR-038 §5), so its ⤢ opens the
 * crawler's live sheet, which the server lets the table runner write
 * (`assertMayEditCrawler`). With no crawler, it says where to raise one.
 *
 * Presentational: `readCrawler()` reads the listing's body.
 */

import { buttonVariants, Stat, tokens } from 'component-lib'
import { Maximize2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { AppLink } from '../shared/AppLink'
import type { CrawlerReading } from './crawlerReading.model'
import { BODY, bandTop, HEAD_ROW, HEADING, MUTED } from './mediatorStyles.model'

const { color, weight } = tokens

const STAT_ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  justifyContent: 'flex-start',
} satisfies CSSProperties

const FOOT: CSSProperties = { ...BODY, marginTop: 'auto', fontWeight: weight.bold }

const NAME: CSSProperties = { ...HEADING, minWidth: 0, overflowWrap: 'anywhere' }

export function CrawlerMinor({
  crawler,
  gameId,
}: {
  crawler: CrawlerReading | null
  gameId: string
}) {
  const panel = { ...bandTop(color.crawler), height: '100%' }
  if (crawler === null) {
    return (
      <section aria-labelledby="mediator-crawler" style={panel}>
        <h2 id="mediator-crawler" style={HEADING}>
          Crawler
        </h2>
        <p style={MUTED}>This Game has no Union Crawler yet.</p>
        <AppLink href={`/games/${gameId}`} style={{ ...BODY, marginTop: 'auto' }}>
          Raise one from the Game page
        </AppLink>
      </section>
    )
  }
  return (
    <section aria-labelledby="mediator-crawler" style={panel}>
      <div style={HEAD_ROW}>
        <h2 id="mediator-crawler" style={NAME}>
          {crawler.name}
        </h2>
        <AppLink
          href={`/sheet/crawler/${crawler.id}`}
          aria-label={`Open ${crawler.name}'s sheet`}
          className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'iconOnly' })}
        >
          <Maximize2 size={14} aria-hidden="true" />
        </AppLink>
      </div>
      {/* Label-first chips (ruleset §3.7): SP, its tech level, and how many of
          its bays are intact out of all of them. */}
      <div style={STAT_ROW}>
        <Stat label="SP" value={crawler.sp} max={crawler.maxSP} orientation="horizontal" />
        {crawler.techLevel !== null && (
          <Stat label="TL" value={crawler.techLevel} orientation="horizontal" />
        )}
        {crawler.bays > 0 && (
          <Stat
            label="Bays"
            value={crawler.baysIntact}
            max={crawler.bays}
            orientation="horizontal"
            hoverText="Bays intact"
          />
        )}
      </div>
      <p style={FOOT}>Yours to edit: you run the table.</p>
    </section>
  )
}
