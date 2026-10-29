import type { RefEntity } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { Box, capsLabel, Entity, Slab } from '../components/index'
import { cn } from '../lib/cn'
import { itemHref } from '../lib/entityHref'
import { referenceCopy } from '../messages/reference'

/**
 * CrawlerTechLevelPage — a Union Crawler Tech Level's Page (R47): mostly
 * stats, so it is drawn as the book draws it rather than as a page of chips,
 * and it uses the sidebar. The book sets each level
 * as a block of text (Core Book p.218: "Structure Points: 20 / Upkeep: 5×
 * Tech 1 Scrap ..."), so the level's facts are that block, read as the book
 * reads them, in a plain Box, never an infobox (R47);
 * the band carries its Tech Level and Structure Points. The
 * sidebar is the ladder, every level a header-only Compact in order, this
 * one marked, the rest linking to their Pages. Every figure is the data's
 * (`crawler-tech-levels.json`); the book's phrasing around it is the
 * catalogue's (`referenceCopy`).
 */

/** One Union Crawler Tech Level, as the data holds it. */
type TechLevel = ReturnType<typeof SalvageUnionReference.CrawlerTechLevels.all>[number]

const NUMBER = new Intl.NumberFormat('en-GB')

function population({ populationMin, populationMax }: TechLevel): string {
  return populationMax == null
    ? `${NUMBER.format(populationMin)} +`
    : `${NUMBER.format(populationMin)} – ${NUMBER.format(populationMax)}`
}

/** One of the book's lines: its label, its figure set large, the words after it. */
type BookLine = { label: string; figure?: string; rest?: string }

/** The book's lines for one level, label first, in its order; its Tech Level
 * and Structure Points are the band's. */
function bookLines(level: TechLevel): BookLine[] {
  const scrap = referenceCopy('techScrap', { tech: level.techLevel })
  return [
    { label: referenceCopy('upkeep'), figure: `${level.upkeepCost}×`, rest: scrap },
    level.upgradeCost == null
      ? {
          label: referenceCopy('upgrade'),
          rest: referenceCopy('highestTechLevel', { tech: level.techLevel }),
        }
      : { label: referenceCopy('upgrade'), figure: `${level.upgradeCost}×`, rest: scrap },
    { label: referenceCopy('approximatePopulation'), figure: population(level) },
  ]
}

export function CrawlerTechLevelPage({ item }: { item: RefEntity }) {
  const ladder = [...SalvageUnionReference.CrawlerTechLevels.all()].sort(
    (a, b) => a.techLevel - b.techLevel
  )
  const level = ladder.find((rung) => rung.id === item.id)
  if (!level) throw new Error(`${item.id} is not a Union Crawler Tech Level`)
  return (
    <div className="su-tech-level">
      <Box className="su-tech-level__block">
        {/* The book's lines, "Upkeep: 5× Tech 1 Scrap", each a fact under a
            crawler-pink rule, its label in caps and its figure set large
            (R47). */}
        <div className="su-tech-level__lines">
          {bookLines(level).map(({ label, figure, rest }) => (
            <div key={label} className="su-tech-level__line">
              <span className={cn(capsLabel(), 'su-tech-level__label')}>{label}</span>
              <p className="su-tech-level__value">
                {figure && <span className="su-tech-level__figure">{figure}</span>}
                {figure && rest ? ' ' : ''}
                {rest}
              </p>
            </div>
          ))}
        </div>
      </Box>
      <aside className="su-tech-level__ladder" aria-label={referenceCopy('unionCrawlerTechLevels')}>
        <Slab as="h2" label={referenceCopy('techLevels')} />
        <ol className="su-tech-level__rungs">
          {ladder.map((rung) => {
            const here = rung.id === item.id
            return (
              <li key={rung.id} aria-current={here ? 'page' : undefined}>
                <Entity
                  size="compact"
                  entity={rung}
                  {...(here
                    ? {}
                    : {
                        mode: {
                          kind: 'link' as const,
                          href: itemHref('crawler-tech-levels', getEntitySlug(rung)),
                        },
                      })}
                />
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
