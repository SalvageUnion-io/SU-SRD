/**
 * `/starter` — the Starter Set's front door: the one address a box owner is
 * sent to (short enough for a QR code in Leyline Press's materials).
 *
 * Laid out as the home page is, the manual's Contents page (`su-home__*`): the
 * band, then a sidebar of steps and an index of chapters. The steps
 * (`StartHere`, with this page's own) open the box's crew in the app, copy the
 * whole crew into the player's Training Bay in one tap (the app's
 * `/starter?copy=crew`, which signs in first), and jump to the first session's
 * rules. On a phone the steps lead; a desktop pins them to the right.
 *
 * The index maps the box's books to this site. "Your first session" is the
 * rules *Reclamation of the Wastes* asks the Mediator to explain before play
 * (its "Running the Campaign", p.6), and the rules its first region leans on.
 * Then each booklet's own Contents page, line by line, each line to the page
 * here that holds it, at the page the booklet prints it on. An entry's page is
 * the dataset's own Starter Set citation (`additionalSources`), so a row can
 * never point at one page while the entity's footer cites another; a line
 * that is a whole catalog opens that catalog filtered to the Starter Set,
 * whose source filter counts reprints. A row whose entry the dataset no longer
 * has is dropped, as the home page drops one.
 */

import type { RefEnumSchemaName } from 'salvageunion-reference'
import { findEntityBySlug } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../../ssg/types'
import type { ContentsRow, StartHereStep } from '../../components/index'
import { ChapterBand, ContentsChapter, StartHere } from '../../components/index'
import { appPath } from '../../lib/appBase'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { PARAM_SOURCE } from '../../lib/listingParams'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import '../../lib/gameData'

/** The dataset's name for the box, as its citations spell it. */
const STARTER_SET = findEntityBySlug('sources', 'salvage-union-starter-set')?.name ?? ''

/** The box's booklets, by the code its citations carry. */
type Booklet = 'PH' | 'PC' | 'CR'

const TITLE = pageTitle(pagesCopy('starterTitle'))
const DESCRIPTION = pagesCopy('starterDescription')

/**
 * A line of a map: an entry by slug, named as the dataset names it and cited
 * where the box prints it, or a catalog or chapter at its page.
 */
type MapLine =
  | { schema: RefEnumSchemaName; slug: string; label?: string; booklet?: Booklet }
  | { label: string; href: string; page: number; booklet?: Booklet }

type BookMap = {
  id: string
  title: string
  tone: 'pilot' | 'mech' | 'crawler' | 'rules' | 'ink'
  /** The booklet every line is in. A first-session map mixes them, and names each. */
  booklet?: Booklet
  lines: MapLine[]
}

/** A catalog filtered to what the box prints, reprints included. */
function inTheBox(schema: RefEnumSchemaName): string {
  return `${schemaHref(schema)}?${new URLSearchParams({ [PARAM_SOURCE]: STARTER_SET })}`
}

/** Where `booklet` prints an entry: the dataset's own Starter Set citation. */
function citedPage(entity: object, booklet: Booklet): number | undefined {
  const cites: unknown[] = [
    entity,
    ...('additionalSources' in entity && Array.isArray(entity.additionalSources)
      ? entity.additionalSources
      : []),
  ]
  for (const cite of cites) {
    if (typeof cite !== 'object' || cite === null) continue
    const { source, booklet: at, page } = cite as Record<string, unknown>
    if (source === STARTER_SET && at === booklet && typeof page === 'number') return page
  }
  return undefined
}

/** `p.14`, or `p.14 CR` on a map that mixes booklets, as the campaign book cites. */
function pageLabel(page: number, booklet: Booklet | undefined): string {
  return booklet ? `p.${page} ${booklet}` : `p.${page}`
}

function rowOf(line: MapLine, map: BookMap): ContentsRow | null {
  const booklet = line.booklet ?? map.booklet
  if (booklet === undefined) return null
  // A mixed map names each line's booklet; a booklet's own map does not.
  const shown = map.booklet === undefined ? booklet : undefined
  if ('href' in line) {
    return { label: line.label, href: line.href, page: pageLabel(line.page, shown) }
  }
  const { schema, slug } = line
  const entity = findEntityBySlug(schema, slug)
  if (!entity) return null
  const page = citedPage(entity, booklet)
  if (page === undefined) return null
  return {
    label: line.label ?? entity.name,
    href: itemHref(schema, slug),
    page: pageLabel(page, shown),
  }
}

/**
 * The maps. "Your first session" follows *Reclamation of the Wastes*: the three
 * rules it has the Mediator explain (p.6), then what its first region calls on
 * (Push, Distances, Initiative, Mech Damage, Mech Salvage) and the Downtime
 * between regions. The booklets' maps follow each booklet's Contents page.
 */
function bookMaps(): BookMap[] {
  return [
    {
      id: 'first-session',
      title: pagesCopy('starterFirstSession'),
      tone: 'ink',
      lines: [
        {
          schema: 'roll-tables',
          slug: 'core-mechanic',
          label: pagesCopy('starterTheCoreMechanic'),
          booklet: 'CR',
        },
        { schema: 'guides', slug: 'heat', booklet: 'CR' },
        // Keywords are lower-case in the dataset; a row names them as the book does.
        {
          schema: 'keywords',
          slug: 'energy-points',
          label: pagesCopy('starterEnergyPoints'),
          booklet: 'CR',
        },
        { schema: 'guides', slug: 'pushing-a-mech', booklet: 'CR' },
        { schema: 'guides', slug: 'tough-choices', booklet: 'CR' },
        { schema: 'roll-tables', slug: 'group-initiative', booklet: 'CR' },
        {
          label: pagesCopy('starterDistances'),
          href: schemaHref('distances'),
          page: 19,
          booklet: 'CR',
        },
        { schema: 'guides', slug: 'mech-damage', booklet: 'CR' },
        { schema: 'roll-tables', slug: 'mech-salvage', booklet: 'CR' },
        { schema: 'guides', slug: 'crawler-downtime', booklet: 'PH' },
      ],
    },
    {
      id: 'pilots-handbook',
      title: pagesCopy('starterPilotsHandbook'),
      tone: 'pilot',
      booklet: 'PH',
      lines: [
        { label: pagesCopy('starterCreatingAPilot'), href: guideHref('create-a-pilot'), page: 4 },
        { label: pagesCopy('starterPilotClasses'), href: schemaHref('classes'), page: 12 },
        ...['engineer', 'hacker', 'hauler', 'scout', 'soldier', 'salvager'].map(
          (slug): MapLine => ({ schema: 'classes', slug })
        ),
        { label: pagesCopy('starterPilotEquipment'), href: inTheBox('equipment'), page: 36 },
        { schema: 'roll-tables', slug: 'callsign-table', label: pagesCopy('starterCallsign') },
        { schema: 'roll-tables', slug: 'background' },
        { schema: 'roll-tables', slug: 'keepsake' },
        { schema: 'roll-tables', slug: 'motto' },
        { schema: 'roll-tables', slug: 'pilot-appearance' },
        { schema: 'roll-tables', slug: 'ai-personality' },
      ],
    },
    {
      id: 'union-crawler',
      title: pagesCopy('starterUnionCrawler'),
      tone: 'crawler',
      booklet: 'PH',
      lines: [
        {
          label: pagesCopy('starterCreatingAUnionCrawler'),
          href: guideHref('create-a-crawler'),
          page: 48,
        },
        { label: pagesCopy('starterCrawlerTypes'), href: schemaHref('crawlers'), page: 52 },
        {
          label: pagesCopy('starterUpkeepAndUpgrade'),
          href: guideHref('upgrading-your-union-crawler'),
          page: 54,
        },
        { schema: 'roll-tables', slug: 'crawler-deterioration' },
        { schema: 'roll-tables', slug: 'crawler-damage' },
        { label: pagesCopy('starterCrawlerBays'), href: inTheBox('crawler-bays'), page: 57 },
        { schema: 'roll-tables', slug: 'crawler-name' },
        { schema: 'guides', slug: 'crawler-downtime', label: pagesCopy('starterDowntime') },
      ],
    },
    {
      id: 'parts-catalogue',
      title: pagesCopy('starterPartsCatalogue'),
      tone: 'mech',
      booklet: 'PC',
      lines: [
        { label: pagesCopy('starterCreatingAMech'), href: guideHref('create-a-mech'), page: 4 },
        { label: pagesCopy('starterMechChassis'), href: inTheBox('chassis'), page: 10 },
        { label: pagesCopy('starterMechSystems'), href: inTheBox('systems'), page: 46 },
        { label: pagesCopy('starterMechModules'), href: inTheBox('modules'), page: 62 },
        { schema: 'roll-tables', slug: 'quirks' },
        { schema: 'roll-tables', slug: 'mech-appearance' },
        { schema: 'roll-tables', slug: 'mech-pattern-names' },
      ],
    },
    {
      id: 'core-rulebook',
      title: pagesCopy('starterCoreRulebook'),
      tone: 'rules',
      booklet: 'CR',
      lines: [
        { schema: 'guides', slug: 'safety-protocols' },
        { schema: 'roll-tables', slug: 'core-mechanic' },
        { schema: 'guides', slug: 'tough-choices' },
        { schema: 'guides', slug: 'pushing-a-mech' },
        { schema: 'guides', slug: 'heat' },
        { schema: 'roll-tables', slug: 'reactor-overload' },
        { schema: 'roll-tables', slug: 'group-initiative' },
        { label: pagesCopy('starterDistances'), href: schemaHref('distances'), page: 19 },
        { schema: 'guides', slug: 'activating-and-shutting-down-a-mech' },
        { schema: 'guides', slug: 'mech-damage' },
        { schema: 'roll-tables', slug: 'critical-damage' },
        { schema: 'guides', slug: 'pilot-damage' },
        { schema: 'roll-tables', slug: 'critical-injury' },
        { schema: 'guides', slug: 'salvaging' },
        { schema: 'roll-tables', slug: 'area-salvage' },
        { schema: 'roll-tables', slug: 'mech-salvage' },
        { label: pagesCopy('starterTraits'), href: inTheBox('traits'), page: 34 },
        { label: pagesCopy('starterKeywords'), href: inTheBox('keywords'), page: 37 },
      ],
    },
  ]
}

/** A guide's page by slug; the guides catalog when the dataset no longer has it. */
function guideHref(slug: string): string {
  return findEntityBySlug('guides', slug) ? itemHref('guides', slug) : schemaHref('guides')
}

/** The box owner's way in: the crew, the crew as their own, the first rules. */
const STEPS: readonly StartHereStep[] = [
  {
    key: 'crew',
    title: pagesCopy('starterMeetTheCrew'),
    tone: 'pilot',
    body: pagesCopy('starterMeetTheCrewBody'),
  },
  {
    key: 'copy',
    title: pagesCopy('starterMakeThemYours'),
    tone: 'mech',
    body: pagesCopy('starterMakeThemYoursBody'),
  },
  {
    key: 'rules',
    title: pagesCopy('starterLearnTheFirstRules'),
    tone: 'crawler',
    body: pagesCopy('starterLearnTheFirstRulesBody'),
  },
]

function page(): PageResult {
  const maps = bookMaps()
  const hrefs = {
    crew: appPath('/starter'),
    copy: appPath('/starter?copy=crew'),
    rules: '#first-session',
  }

  return {
    meta: { title: TITLE, description: DESCRIPTION },
    children: (
      <div className="su-home">
        <div className="su-home__band">
          <ChapterBand
            tone="build"
            measure={PAGE_MEASURE}
            aside={<p className="su-home__lede">{pagesCopy('starterLede')}</p>}
          >
            {pagesCopy('starterTitle')}
          </ChapterBand>
        </div>
        <div className="su-home__body su-page-body">
          <aside className="su-home__aside" aria-label={pagesCopy('starterYourCrew')}>
            <StartHere
              id="your-crew"
              title={pagesCopy('starterOpenTheBox')}
              steps={STEPS}
              hrefs={hrefs}
            />
          </aside>
          <div className="su-home__index">
            {maps.map((map) => (
              <ContentsChapter
                key={map.id}
                id={map.id}
                title={map.title}
                tone={map.tone}
                rows={map.lines.flatMap((line) => rowOf(line, map) ?? [])}
              />
            ))}
          </div>
        </div>
      </div>
    ),
  }
}

export const starterPage: PageModule = {
  pattern: '/starter',
  page,
}
