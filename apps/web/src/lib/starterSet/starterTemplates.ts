/**
 * The book crews' templates as public pages: which builds there are, which
 * book's crew each belongs to, where each one lives, and what its page is
 * called. Two crews share the `/starter` pages: the Starter Set's and the
 * Quickstart's (`STARTER_ROSTERS`). Template ids are unique across both, so a
 * build's address never needs its crew.
 *
 * Light on purpose. The `/starter` routes read it for their titles, and the
 * Worker reads it for the same pages' titles, descriptions, canonicals and
 * sitemap (`src/worker/publicPages.ts`), so it imports only the static
 * templates and the title format: never a store, the reference or Convex.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { isSheetKind, SHEET_KINDS } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import {
  QUICKSTART_MECHS,
  QUICKSTART_PILOTS,
  QUICKSTART_SOFT_LINKS,
} from 'game-domain/starterSet/quickstart'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from 'game-domain/starterSet/starterSet'
import { areaTitle, pageTitle } from '../pageTitle'

/** Who the Starter Set belongs to — the seal on every row and sheet. */
export const STARTER_SET_PUBLISHER = 'Leyline Press'

/** The adventure the pre-generated crew comes from. */
export const STARTER_SET_ADVENTURE = 'Reclamation of the Wastes'

/** The Quickstart's own name: its premade crew is Crawler #279's. */
export const QUICKSTART_BOOK = 'Salvage Union Quickstart'

export type StarterRosterId = 'starter-set' | 'quickstart'

/** One book's pre-generated crew: what the site calls it, and its builds and links. */
export type StarterRoster = {
  id: StarterRosterId
  /** Its short name, the one a title and a Slab say: "Starter Set". */
  name: string
  /** Where it comes from, as a page's description says it. */
  from: string
  pilots: readonly Pilot[]
  mechs: readonly Mech[]
  crawlers: readonly Crawler[]
  softLinks: readonly SoftLink[]
}

/** Every book crew, the Starter Set first. */
export const STARTER_ROSTERS: readonly StarterRoster[] = [
  {
    id: 'starter-set',
    name: 'Starter Set',
    from: `the Salvage Union Starter Set, ${STARTER_SET_ADVENTURE}`,
    pilots: STARTER_PILOTS,
    mechs: STARTER_MECHS,
    crawlers: STARTER_CRAWLERS,
    softLinks: STARTER_SOFT_LINKS,
  },
  {
    id: 'quickstart',
    name: 'Quickstart',
    from: `the ${QUICKSTART_BOOK}`,
    pilots: QUICKSTART_PILOTS,
    mechs: QUICKSTART_MECHS,
    crawlers: [],
    softLinks: QUICKSTART_SOFT_LINKS,
  },
]

/** A crew by id. */
export function starterRoster(id: StarterRosterId): StarterRoster {
  const roster = STARTER_ROSTERS.find((r) => r.id === id)
  if (roster === undefined) throw new Error(`There is no book crew "${id}".`)
  return roster
}

function rosterTemplates(
  roster: StarterRoster,
  kind: SheetKind
): readonly (Pilot | Mech | Crawler)[] {
  return kind === 'pilot' ? roster.pilots : kind === 'mech' ? roster.mechs : roster.crawlers
}

/** Every template of a kind: one crew's, or every crew's in order. */
export function starterTemplates(
  kind: SheetKind,
  roster?: StarterRosterId
): readonly (Pilot | Mech | Crawler)[] {
  const rosters = roster === undefined ? STARTER_ROSTERS : [starterRoster(roster)]
  return rosters.flatMap((r): (Pilot | Mech | Crawler)[] => [...rosterTemplates(r, kind)])
}

/** One template by kind and id, or null when there is no such template. */
export function starterTemplate(kind: SheetKind, id: string): Pilot | Mech | Crawler | null {
  return starterTemplates(kind).find((t) => t.id === id) ?? null
}

/** The crew a template belongs to, or null when no crew holds that id. */
export function rosterOf(id: string): StarterRoster | null {
  return (
    STARTER_ROSTERS.find((r) =>
      SHEET_KINDS.some((kind) => rosterTemplates(r, kind).some((t) => t.id === id))
    ) ?? null
  )
}

/** What a page calls a build of each kind. */
const KIND_LABEL: Record<SheetKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Union Crawler',
}

/** One Starter Set build's page: its address inside the app, and its words. */
export type StarterPage = {
  /** The client route, inside the app's base: `/starter/pilot/starter-pilot-bonesaw`. */
  path: string
  /** The tab title: `Bonesaw · Starter Set Pilot · SalvageUnion.io`. */
  title: string
  description: string
}

function pageOf(kind: SheetKind, template: Pilot | Mech | Crawler): StarterPage {
  const label = KIND_LABEL[kind]
  const roster = rosterOf(template.id) ?? starterRoster('starter-set')
  const intro = `${template.name}, a pre-generated ${label} from ${roster.from} by ${STARTER_SET_PUBLISHER}.`
  const flavour = template.description?.trim()
  return {
    path: `/starter/${kind}/${template.id}`,
    // No area in a build's title: its name and its crew's book fill the room a title has.
    title: pageTitle(`${template.name} · ${roster.name} ${label}`),
    description: flavour ? `${intro} ${flavour}` : intro,
  }
}

/** A build's page by its route params, or null when no crew has such a build. */
export function starterPage(kind: string, id: string): StarterPage | null {
  if (!isSheetKind(kind)) return null
  const template = starterTemplate(kind, id)
  return template === null ? null : pageOf(kind, template)
}

/** Every build's page, crew by crew, pilots first, as each crew lists them. */
export function starterPages(): StarterPage[] {
  return STARTER_ROSTERS.flatMap((roster) =>
    SHEET_KINDS.flatMap((kind) => starterTemplates(kind, roster.id).map((t) => pageOf(kind, t)))
  )
}

/** The Starter Set roster's own title, and any build's page that names nothing. */
export const STARTER_SET_TITLE = areaTitle(PRODUCT.build, 'Starter Set')

/** A build's tab title by its route params; the Starter Set's own for one it does not hold. */
export function starterPageTitle(kind: string, id: string): string {
  return starterPage(kind, id)?.title ?? STARTER_SET_TITLE
}
