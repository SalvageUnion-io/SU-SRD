import type { RefEntity } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { capsLabel } from '../components/atoms/capsLabel'
import { Box, Entity, Slab } from '../components/index'
import { cn } from '../lib/cn'
import { itemHref } from '../lib/entityHref'

/**
 * CrawlerTechLevelPage — a Union Crawler Tech Level's Page (owner,
 * 2026-10-20: "Crawler tech levels need a unique rendering. They are mostly
 * stats, and therefore render as a blank page full of chips ... lets
 * redesign it, taking use of the sidebar space"). The book sets each level
 * as a block of text (Core Book p.218: "Structure Points: 20 / Upkeep: 5×
 * Tech 1 Scrap ..."), so the level's facts are that block, read as the book
 * reads them, in a plain Box (owner, round 6: "should not be a infobox");
 * the band carries its Tech Level and Structure Points. The
 * sidebar is the ladder, every level a header-only Compact in order, this
 * one marked, the rest linking to their Pages. Every word is the data's
 * (`crawler-tech-levels.json`), the book's phrasing around it.
 */

type TechLevel = {
  name: string
  techLevel: number
  structurePoints: number
  upkeepCost: number
  upgradeCost: number | null
  populationMin: number
  populationMax: number | null
}

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
  const scrap = `Tech ${level.techLevel} Scrap`
  return [
    { label: 'Upkeep', figure: `${level.upkeepCost}×`, rest: scrap },
    level.upgradeCost == null
      ? {
          label: 'Upgrade',
          rest: `Tech ${level.techLevel} is the highest level of Union Crawler and it cannot be upgraded further.`,
        }
      : { label: 'Upgrade', figure: `${level.upgradeCost}×`, rest: scrap },
    { label: 'Approximate Population', figure: population(level) },
  ]
}

export function CrawlerTechLevelPage({ item }: { item: RefEntity }) {
  const level = item as unknown as TechLevel
  const ladder = [...SalvageUnionReference.CrawlerTechLevels.all()].sort(
    (a, b) => a.techLevel - b.techLevel
  )
  return (
    <div className="su-tech-level">
      <Box className="su-tech-level__block">
        {/* The book's lines, "Upkeep: 5× Tech 1 Scrap", each a fact under a
            crawler-pink rule, its label in caps and its figure set large
            (owner, round 8: "a bit stark ... jazz it up"). */}
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
      <aside className="su-tech-level__ladder" aria-label="Union Crawler Tech Levels">
        <Slab as="h2" label="Tech Levels" />
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
