import { assetSrcSetFor } from 'component-lib'
import { assetUrl } from 'salvageunion-reference'
import { STARTER_SET_HREF } from '../lib/buildLink'
import { buildChapters } from '../lib/chapters'
import { DISCORD_INSTALL_URL, ITUN_URL } from '../lib/constants'
import type { ContentsArt } from './HomeContents'
import { ContentsChapter, DiscordBot, HomeStartHere } from './HomeContents'

export default {
  title: 'Compositions/Shell/Home Contents',
}

const GUIDES = {
  pilot: '/guides/create-a-pilot/',
  mech: '/guides/create-a-mech/',
  crawler: '/guides/create-a-crawler/',
}

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
  { label: 'The Core Mechanic', href: '/roll-tables/core-mechanic/' },
  { label: 'Heat', href: '/guides/heat/' },
  { label: 'Mech Damage', href: '/guides/mech-damage/' },
  { label: 'Tough Choices', href: '/guides/tough-choices/' },
  { label: 'Salvaging', href: '/guides/salvaging/' },
]

/**
 * The SRD home as the manual's Contents page (board 06): the "Getting started"
 * aside — the shared "Start here" path — and the Discord bot beside the book's
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
      <HomeStartHere guideHrefs={GUIDES} buildHref={ITUN_URL} starterSetHref={STARTER_SET_HREF} />
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
