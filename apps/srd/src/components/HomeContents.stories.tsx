import { assetSrcSetFor } from 'component-lib'
import { assetUrl } from 'salvageunion-reference'
import { STARTER_SET_HREF } from '../lib/buildLink'
import { buildChapters } from '../lib/chapters'
import { DISCORD_INSTALL_URL, ITUN_URL } from '../lib/constants'
import type { ContentsArt } from './HomeContents'
import { ContentsChapter, DiscordBot, NewToTheUnion } from './HomeContents'

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

/** The chapter openers' artwork, as the home page resolves it (`index.page.tsx`). */
const ART: Partial<Record<string, ContentsArt>> = Object.fromEntries(
  Object.entries({
    'pilot-bay': 'classes/hacker.webp',
    'mech-workshop': 'chassis/mule.webp',
    denizens: 'bio-titans/tyrant.webp',
  }).map(([id, key]) => {
    const src = assetUrl(key)
    return [id, { src, srcSet: assetSrcSetFor(src) }]
  })
)

const AT_THE_TABLE = [
  { label: 'The Core Mechanic', href: '/schema/roll-tables/item/core-mechanic/' },
  { label: 'Heat', href: '/schema/guides/item/heat/' },
  { label: 'Mech Damage', href: '/schema/guides/item/mech-damage/' },
  { label: 'Tough Choices', href: '/schema/guides/item/tough-choices/' },
  { label: 'Salvaging', href: '/schema/guides/item/salvaging/' },
]

/**
 * The SRD home as the manual's Contents page (board 06): the "Getting started"
 * aside — the "New to the Union?" path — and the Discord bot beside the book's
 * chapters as an index, each opened by its colour band and, for Pilot Bay,
 * Mech Workshop and Denizens, a piece of su-assets artwork, with real entry
 * counts (from `buildChapters`, the same source the nav drawer is frozen
 * from), then "At the table" under an ink band. The aside and the bot are a
 * right-hand sidebar on a wide screen; on a phone the aside leads the stack
 * and the bot follows the index. Rows are 36px for a mouse and 44px for a
 * finger.
 */
export const Default = () => (
  <div className="srd-home__body">
    <aside className="srd-home__aside" aria-label="Getting started">
      <NewToTheUnion steps={STEPS} buildHref={ITUN_URL} starterSetHref={STARTER_SET_HREF} />
    </aside>
    <div className="srd-home__index">
      {buildChapters().map((chapter) => (
        <ContentsChapter
          key={chapter.id}
          id={chapter.id}
          title={chapter.title}
          tone={chapter.tone}
          rows={chapter.rows}
          total={chapter.total}
          art={ART[chapter.id]}
        />
      ))}
      <ContentsChapter id="at-the-table" title="At the table" tone="ink" rows={AT_THE_TABLE} />
    </div>
    <div className="srd-home__discord">
      <DiscordBot installHref={DISCORD_INSTALL_URL} aboutHref="/discord/" />
    </div>
  </div>
)
