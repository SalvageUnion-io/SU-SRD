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
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../../ssg/types'
import type { ContentsRow, StartHereStep } from '../../components/index'
import { ChapterBand, ContentsChapter, StartHere } from '../../components/index'
import { appPath } from '../../lib/appBase'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { PARAM_SOURCE } from '../../lib/listingParams'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import '../../lib/gameData'

/** The dataset's name for the box, as its citations spell it. */
const STARTER_SET = 'Salvage Union Starter Set'

/** The box's booklets, by the code its citations carry. */
type Booklet = 'PH' | 'PC' | 'CR'

const TITLE = pageTitle('Starter Set')
const DESCRIPTION =
  'Got the Salvage Union Starter Set? Start here: the premade crew of Crawler #430 ready to copy and play, the rules for your first session, and every chapter of the Pilot’s Handbook, Parts Catalogue and Core Rulebook mapped to its page.'

/** A line of a map: an entry, cited where the box prints it, or a catalog or chapter at its page. */
type MapLine =
  | { schema: RefEnumSchemaName; name: string; label?: string; booklet?: Booklet }
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
  const { schema, name } = line
  // Keywords are lower-case in the dataset ("energy points"); a row names them as the book does.
  const entity = SalvageUnionReference.findIn(
    schema,
    (e) => e.name.toLowerCase() === name.toLowerCase()
  )
  if (!entity) return null
  const page = citedPage(entity, booklet)
  if (page === undefined) return null
  return {
    label: line.label ?? name,
    href: itemHref(schema, getEntitySlug(entity)),
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
      title: 'Your first session',
      tone: 'ink',
      lines: [
        { schema: 'roll-tables', name: 'Core Mechanic', label: 'The Core Mechanic', booklet: 'CR' },
        { schema: 'guides', name: 'Heat', booklet: 'CR' },
        { schema: 'keywords', name: 'Energy Points', booklet: 'CR' },
        { schema: 'guides', name: 'Pushing a Mech', booklet: 'CR' },
        { schema: 'guides', name: 'Tough Choices', booklet: 'CR' },
        { schema: 'roll-tables', name: 'Group Initiative', booklet: 'CR' },
        { label: 'Distances', href: schemaHref('distances'), page: 19, booklet: 'CR' },
        { schema: 'guides', name: 'Mech Damage', booklet: 'CR' },
        { schema: 'roll-tables', name: 'Mech Salvage', booklet: 'CR' },
        { schema: 'guides', name: 'Crawler Downtime', booklet: 'PH' },
      ],
    },
    {
      id: 'pilots-handbook',
      title: 'Pilot’s Handbook',
      tone: 'pilot',
      booklet: 'PH',
      lines: [
        { label: 'Creating a Pilot', href: guideHref('Create a Pilot'), page: 4 },
        { label: 'Pilot Classes', href: schemaHref('classes'), page: 12 },
        ...['Engineer', 'Hacker', 'Hauler', 'Scout', 'Soldier', 'Salvager'].map(
          (name): MapLine => ({ schema: 'classes', name })
        ),
        { label: 'Pilot Equipment', href: inTheBox('equipment'), page: 36 },
        { schema: 'roll-tables', name: 'Callsign Table', label: 'Callsign' },
        { schema: 'roll-tables', name: 'Background' },
        { schema: 'roll-tables', name: 'Keepsake' },
        { schema: 'roll-tables', name: 'Motto' },
        { schema: 'roll-tables', name: 'Pilot Appearance' },
        { schema: 'roll-tables', name: 'A.I. Personality' },
      ],
    },
    {
      id: 'union-crawler',
      title: 'Pilot’s Handbook: Union Crawler',
      tone: 'crawler',
      booklet: 'PH',
      lines: [
        { label: 'Creating a Union Crawler', href: guideHref('Create a Crawler'), page: 48 },
        { label: 'Crawler Types', href: schemaHref('crawlers'), page: 52 },
        { label: 'Upkeep & Upgrade', href: guideHref('Upgrading your Union Crawler'), page: 54 },
        { schema: 'roll-tables', name: 'Crawler Deterioration' },
        { schema: 'roll-tables', name: 'Crawler Damage' },
        { label: 'Crawler Bays', href: inTheBox('crawler-bays'), page: 57 },
        { schema: 'roll-tables', name: 'Crawler Name' },
        { schema: 'guides', name: 'Crawler Downtime', label: 'Downtime' },
      ],
    },
    {
      id: 'parts-catalogue',
      title: 'Parts Catalogue',
      tone: 'mech',
      booklet: 'PC',
      lines: [
        { label: 'Creating a Mech', href: guideHref('Create a Mech'), page: 4 },
        { label: 'Mech Chassis', href: inTheBox('chassis'), page: 10 },
        { label: 'Mech Systems', href: inTheBox('systems'), page: 46 },
        { label: 'Mech Modules', href: inTheBox('modules'), page: 62 },
        { schema: 'roll-tables', name: 'Quirks' },
        { schema: 'roll-tables', name: 'Mech Appearance' },
        { schema: 'roll-tables', name: 'Mech Pattern Names' },
      ],
    },
    {
      id: 'core-rulebook',
      title: 'Core Rulebook',
      tone: 'rules',
      booklet: 'CR',
      lines: [
        { schema: 'guides', name: 'Safety Protocols' },
        { schema: 'roll-tables', name: 'Core Mechanic' },
        { schema: 'guides', name: 'Tough Choices' },
        { schema: 'guides', name: 'Pushing a Mech' },
        { schema: 'guides', name: 'Heat' },
        { schema: 'roll-tables', name: 'Reactor Overload' },
        { schema: 'roll-tables', name: 'Group Initiative' },
        { label: 'Distances', href: schemaHref('distances'), page: 19 },
        { schema: 'guides', name: 'Activating and Shutting Down a Mech' },
        { schema: 'guides', name: 'Mech Damage' },
        { schema: 'roll-tables', name: 'Critical Damage' },
        { schema: 'guides', name: 'Pilot Damage' },
        { schema: 'roll-tables', name: 'Critical Injury' },
        { schema: 'guides', name: 'Salvaging' },
        { schema: 'roll-tables', name: 'Area Salvage' },
        { schema: 'roll-tables', name: 'Mech Salvage' },
        { label: 'Traits', href: inTheBox('traits'), page: 34 },
        { label: 'Keywords', href: inTheBox('keywords'), page: 37 },
      ],
    },
  ]
}

/** A guide's page by name; the guides catalog when the dataset no longer has it. */
function guideHref(name: string): string {
  const guide = SalvageUnionReference.findIn('guides', (e) => e.name === name)
  return guide ? itemHref('guides', getEntitySlug(guide)) : schemaHref('guides')
}

/** The box owner's way in: the crew, the crew as their own, the first rules. */
const STEPS: readonly StartHereStep[] = [
  {
    key: 'crew',
    title: 'Meet the crew',
    tone: 'pilot',
    body: 'Six premade Pilots, their Mechs and Crawler #430 ‘Tenacity’, as the sheets in your box print them.',
  },
  {
    key: 'copy',
    title: 'Make them yours',
    tone: 'mech',
    body: 'Copy the whole crew into your Training Bay in one tap, crewed and docked, to play and level up.',
  },
  {
    key: 'rules',
    title: 'Learn the first rules',
    tone: 'crawler',
    body: 'The rules your first session needs, then every chapter of your books mapped to its page here.',
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
            aside={
              <p className="su-home__lede">
                Got the box? This is your way in: the crew, ready to play, and your books, page by
                page.
              </p>
            }
          >
            Starter Set
          </ChapterBand>
        </div>
        <div className="su-home__body su-page-body">
          <aside className="su-home__aside" aria-label="Your crew">
            <StartHere id="your-crew" title="Open the box" steps={STEPS} hrefs={hrefs} />
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
