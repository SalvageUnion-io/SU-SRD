import { appPath } from '../../lib/appBase'
import { unionBarCopy } from '../../messages/components-union-bar'

/** One link inside an area. */
type AreaLink = { label: string; href: string }

/** An area: its name and the pages inside it. */
export type AreaNav = { name: string; links: readonly AreaLink[] }

/**
 * The site's map by area, the one list both the bar's rail (`AppBar`, from
 * `lg`) and the phone's drawer (`UnionDrawer`) draw: each area's name and the
 * pages inside it, each href spelled once. The drawer lists the Reference as
 * the book's chapters (`NAV_CATALOG`), so it reads only Build and Play here.
 */
export const AREA_NAV = {
  reference: {
    name: unionBarCopy('navReference'),
    links: [
      { label: unionBarCopy('navPilots'), href: '/pilots/' },
      { label: unionBarCopy('navMechs'), href: '/mechs/' },
      { label: unionBarCopy('navUnionCrawler'), href: '/union-crawler/' },
      { label: unionBarCopy('navWasteland'), href: '/wasteland/' },
      { label: unionBarCopy('navRules'), href: '/rules/' },
      { label: unionBarCopy('navGuides'), href: '/guides/' },
      { label: unionBarCopy('navRollTables'), href: '/roll-tables/' },
    ],
  },
  build: {
    name: unionBarCopy('navBuild'),
    links: [
      { label: unionBarCopy('navPilots'), href: appPath('/#pilots') },
      { label: unionBarCopy('navMechs'), href: appPath('/#mechs') },
      { label: unionBarCopy('navCrawlers'), href: appPath('/#crawlers') },
      { label: unionBarCopy('navPatterns'), href: appPath('/#patterns') },
      { label: unionBarCopy('navStarterSet'), href: appPath('/starter') },
    ],
  },
  play: {
    name: unionBarCopy('navPlay'),
    links: [
      { label: unionBarCopy('navYourGames'), href: appPath('/games/') },
      { label: unionBarCopy('navJoin'), href: appPath('/games/#join') },
      { label: unionBarCopy('navKit'), href: appPath('/games/#kit') },
    ],
  },
} as const satisfies Record<string, AreaNav>

/** The bar's areas, in its order. */
export type Area = keyof typeof AREA_NAV
