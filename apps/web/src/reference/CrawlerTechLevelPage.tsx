import type { RefEntity } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { Entity, Slab, Stat, TitledBox } from '../components/index'
import { itemHref } from '../lib/entityHref'

/**
 * CrawlerTechLevelPage — a Union Crawler Tech Level's Page (owner,
 * 2026-10-20: "Crawler tech levels need a unique rendering. They are mostly
 * stats, and therefore render as a blank page full of chips ... lets
 * redesign it, taking use of the sidebar space"). The book sets each level
 * as a block of text (Core Book p.218: "Structure Points: 20 / Upkeep: 5×
 * Tech 1 Scrap ..."), so the level's facts are that block, read as the book
 * reads them, on its own TitledBox; the band carries only its Tech Level. The
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

/** The book's lines for one level, label first, in its order; its Tech Level
 * and Structure Points are the box's chips (owner, round 4). */
function bookLines(level: TechLevel): { label: string; value: string }[] {
  const scrap = `Tech ${level.techLevel} Scrap`
  return [
    { label: 'Upkeep', value: `${level.upkeepCost}× ${scrap}` },
    {
      label: 'Upgrade',
      value:
        level.upgradeCost == null
          ? `Tech ${level.techLevel} is the highest level of Union Crawler and it cannot be upgraded further.`
          : `${level.upgradeCost}× ${scrap}`,
    },
    { label: 'Approximate Population', value: population(level) },
  ]
}

export function CrawlerTechLevelPage({ item }: { item: RefEntity }) {
  const level = item as unknown as TechLevel
  const ladder = [...SalvageUnionReference.CrawlerTechLevels.all()].sort(
    (a, b) => a.techLevel - b.techLevel
  )
  return (
    <div className="su-tech-level">
      <TitledBox
        title={`Tech ${level.techLevel} – ${level.name}`}
        titleAs="h2"
        tone="crawler"
        className="su-tech-level__block"
        // Its stats are chips beside the name, as an entity's are (owner,
        // round 4: "move SP and Tech to Chips for the main content as well").
        chips={
          <>
            <Stat label="Tech Level" value={level.techLevel} size="full" />
            <Stat label="Structure Points" value={level.structurePoints} size="full" />
          </>
        }
      >
        {/* The book's lines as it prints them, "Upkeep: 5× Tech 1 Scrap". */}
        <div className="su-tech-level__lines">
          {bookLines(level).map(({ label, value }) => (
            <p key={label} className="su-tech-level__line">
              <strong>{label}:</strong> {value}
            </p>
          ))}
        </div>
      </TitledBox>
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
