/**
 * CrawlerSheet — read-only crawler section for the sheet view.
 *
 * Renders: crawler name + tech level, bays, systems, and pilot roster.
 * When no pilots are wired, renders CrawlerPilotsStandIn.
 *
 * Pilot data is dep-injectable for testing via the `pilots` prop.
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { Pilot } from '../../lib/schemas/pilot'
import { CrawlerPilotsStandIn } from '../shared/CrawlerPilotsStandIn'

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * Resolved pilot records for the pilots wired to this crawler.
   * When empty, renders the stand-in placeholder.
   */
  pilots?: Pilot[]
}

export function CrawlerSheet({ crawler, pilots = [] }: CrawlerSheetProps) {
  return (
    <section aria-labelledby="crawler-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 id="crawler-sheet-heading" className="text-xl font-bold">
          {crawler.name}
        </h2>
        <p className="text-sm text-muted-foreground">Tech Level: {crawler.techLevel}</p>
      </div>

      {/* Bays */}
      {crawler.bays.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Bays
          </h3>
          <ul className="flex flex-col gap-1">
            {crawler.bays.map((slug, i) => (
              <li key={`${slug}-${i}`} className="rounded border border-border px-2 py-1 text-sm">
                {slug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Systems */}
      {crawler.systems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Systems
          </h3>
          <ul className="flex flex-col gap-1">
            {crawler.systems.map((slug) => (
              <li key={slug} className="rounded border border-border px-2 py-1 text-sm">
                {slug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pilot Roster */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Pilot Roster
        </h3>
        {pilots.length === 0 ? (
          <CrawlerPilotsStandIn />
        ) : (
          <ul className="flex flex-col gap-1">
            {pilots.map((pilot) => (
              <li key={pilot.id} className="rounded border border-border px-2 py-1 text-sm">
                {pilot.callsign ? `"${pilot.callsign}" ` : ''}
                {pilot.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
