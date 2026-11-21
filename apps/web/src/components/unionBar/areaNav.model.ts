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
      // The book's chapters, each by the one name its page and the Contents
      // give it (`lib/chapters.ts`; `chapters.test.ts` holds them equal).
      { label: unionBarCopy('navPilotBay'), href: '/pilots/' },
      { label: unionBarCopy('navMechWorkshop'), href: '/mechs/' },
      { label: unionBarCopy('navUnionCrawler'), href: '/union-crawler/' },
      { label: unionBarCopy('navDenizens'), href: '/wasteland/' },
      { label: unionBarCopy('navRulesReference'), href: '/rules/' },
      { label: unionBarCopy('navGuides'), href: '/guides/' },
      { label: unionBarCopy('navRollTables'), href: '/roll-tables/' },
    ],
  },
  build: {
    name: unionBarCopy('navBuild'),
    links: [
      // In-page links: each `#id` is on the Training Bay signed in (its
      // shelves) and on its front door signed out (`areaAnchors` is checked
      // against both). The front door has no patterns, so that is a page.
      { label: unionBarCopy('navPilots'), href: appPath('/#shelf-pilots') },
      { label: unionBarCopy('navMechs'), href: appPath('/#shelf-mechs') },
      { label: unionBarCopy('navCrawlers'), href: appPath('/#shelf-crawlers') },
      { label: unionBarCopy('navPatterns'), href: appPath('/patterns') },
      { label: unionBarCopy('navStarterSet'), href: appPath('/starter') },
    ],
  },
  play: {
    name: unionBarCopy('navPlay'),
    links: [
      { label: unionBarCopy('navYourGames'), href: appPath('/games/') },
      { label: unionBarCopy('navJoin'), href: appPath('/games/#join') },
      { label: unionBarCopy('navKit'), href: appPath('/games/#mediators-kit') },
    ],
  },
} as const satisfies Record<string, AreaNav>

/** The bar's areas, in its order. */
export type Area = keyof typeof AREA_NAV

/**
 * The ids an area's in-page links (`…/#id`) point at. Each must be on the
 * area's landing page, signed in and signed out: a link with no target only
 * changes the address (MD-03, SB-07, PT-22). The landing pages' tests check
 * every one.
 */
export function areaAnchors(area: Area): string[] {
  return AREA_NAV[area].links.flatMap((link) => {
    const hash = link.href.indexOf('#')
    return hash === -1 ? [] : [link.href.slice(hash + 1)]
  })
}
