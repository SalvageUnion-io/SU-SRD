/**
 * CrawlerMinor — the Game's primary crawler on the Mediator Dashboard (board
 * M1; docs/architecture/mediator-dashboard.md Q6): the crawler as the Row
 * every crew list draws it as, its readings label-first chips (`TL | 3`,
 * `SP | 14/20`, `BAYS | 4/5`), under "Yours to edit: you run the table."
 *
 * The crawler is the Mediator's to run (ADR-038 §5), so the Row opens the
 * crawler's live sheet, which the server lets the table runner write
 * (`assertMayEditCrawler`). With no crawler, it says where to raise one. It is
 * a `TitledBox` in the crawler's pink, as each of the dashboard's sections is.
 *
 * Presentational: `readCrawler()` reads the listing's body.
 */

import { gamePath } from 'cantina-domain/entityKinds'
import type { CSSProperties } from 'react'
import { unitRowModel } from '../../lib/units/unitModel'
import { EmptyState, Entity, TitledBox, tokens } from '../index'
import { AppLink } from '../shared/AppLink'
import type { CrawlerReading } from './crawlerReading.model'
import { crawlerReadings } from './crawlerReading.model'
import { BODY } from './mediatorStyles.model'

const { weight } = tokens

const FOOT = { ...BODY, marginTop: 'auto', fontWeight: weight.bold } satisfies CSSProperties

export function CrawlerMinor({
  crawler,
  gameId,
}: {
  crawler: CrawlerReading | null
  gameId: string
}) {
  return (
    <TitledBox as="section" title="Crawler" titleAs="h2" tone="crawler">
      {crawler === null ? (
        <>
          <EmptyState variant="quiet" body="This Game has no Union Crawler yet." />
          <AppLink href={gamePath(gameId)} style={{ ...BODY, marginTop: 'auto' }}>
            Raise one from the Game page
          </AppLink>
        </>
      ) : (
        <>
          <Entity
            form="row"
            model={unitRowModel({
              kind: 'crawler',
              name: crawler.name,
              readings: crawlerReadings(crawler),
            })}
            titleAs="h3"
            mode={{
              kind: 'link',
              href: `/sheet/crawler/${crawler.id}`,
              attrs: { 'aria-label': `Open ${crawler.name}'s sheet` },
            }}
          />
          <p style={FOOT}>Yours to edit: you run the table.</p>
        </>
      )}
    </TitledBox>
  )
}
