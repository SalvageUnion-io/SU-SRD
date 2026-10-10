import { buildChapters } from '../lib/chapters'
import { ITUN_URL } from '../lib/constants'
import { AtTheTable, ContentsChapter, NewToTheUnion } from './HomeContents'

export default {
  title: 'Compositions/Shell/Home Contents',
}

const STEPS = [
  {
    title: 'Create a Pilot',
    meta: 'Pilot Bay · Classes · Keepsake',
    href: '/schema/guides/item/create-a-pilot/',
  },
  {
    title: 'Create a Mech',
    meta: 'Mech Workshop · Chassis · Systems',
    href: '/schema/guides/item/create-a-mech/',
  },
  {
    title: 'Create a Crawler',
    meta: 'Union Crawler · Type · Bays',
    href: '/schema/guides/item/create-a-crawler/',
  },
]

const AT_THE_TABLE = [
  { label: 'The Core Mechanic', href: '/schema/roll-tables/item/core-mechanic/' },
  { label: 'Heat', href: '/schema/guides/item/heat/' },
  { label: 'Mech Damage', href: '/schema/guides/item/mech-damage/' },
  { label: 'Tough Choices', href: '/schema/guides/item/tough-choices/' },
  { label: 'Salvaging', href: '/schema/guides/item/salvaging/' },
]

/**
 * The SRD home as the manual's Contents page (board 06): the book's chapters
 * as an index, each with its colour band and real entry counts (from
 * `buildChapters`, the same source the nav drawer is frozen from), and the
 * "New to the Union?" path and "At the table" links beside them. Rows are
 * 36px for a mouse and 44px for a finger.
 */
export const Default = () => (
  <div className="srd-home__body">
    <div className="srd-home__chapters">
      {buildChapters().map((chapter) => (
        <ContentsChapter
          key={chapter.id}
          id={chapter.id}
          title={chapter.title}
          tone={chapter.tone}
          rows={chapter.rows}
          total={chapter.total}
        />
      ))}
    </div>
    <aside className="srd-home__aside" aria-label="Getting started">
      <NewToTheUnion steps={STEPS} buildHref={ITUN_URL} />
      <AtTheTable links={AT_THE_TABLE} />
    </aside>
  </div>
)
