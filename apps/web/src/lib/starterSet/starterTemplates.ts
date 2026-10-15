/**
 * The Starter Set's templates as public pages: which builds there are, where
 * each one lives, and what its page is called.
 *
 * Light on purpose. The `/starter` routes read it for their titles, and the
 * Worker reads it for the same pages' titles, descriptions, canonicals and
 * sitemap (`src/worker/publicPages.ts`), so it imports only the static
 * templates and the title format: never a store, the reference or Convex.
 */

import type { SheetKind } from 'cantina-domain/entityKinds'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
} from 'cantina-domain/starterSet/starterSet'
import { pageTitle } from '../pageTitle'

/** Who the Starter Set belongs to — the seal on every row and sheet. */
export const STARTER_SET_PUBLISHER = 'Leyline Press'

/** The adventure the pre-generated crew comes from. */
export const STARTER_SET_ADVENTURE = 'Reclamation of the Wastes'

/** The kinds of build the Starter Set holds. */
export type StarterKind = SheetKind

const STARTER_KINDS: readonly StarterKind[] = ['pilot', 'mech', 'crawler']

export function isStarterKind(value: string): value is StarterKind {
  return (STARTER_KINDS as readonly string[]).includes(value)
}

function templatesOf(kind: StarterKind): readonly (Pilot | Mech | Crawler)[] {
  return kind === 'pilot' ? STARTER_PILOTS : kind === 'mech' ? STARTER_MECHS : STARTER_CRAWLERS
}

/** One template by kind and id, or null when there is no such template. */
export function starterTemplate(kind: StarterKind, id: string): Pilot | Mech | Crawler | null {
  return templatesOf(kind).find((t) => t.id === id) ?? null
}

/** What a page calls a build of each kind. */
const KIND_LABEL: Record<StarterKind, string> = {
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

function pageOf(kind: StarterKind, template: Pilot | Mech | Crawler): StarterPage {
  const label = KIND_LABEL[kind]
  const intro = `${template.name}, a pre-generated ${label} from the Salvage Union Starter Set, ${STARTER_SET_ADVENTURE} by ${STARTER_SET_PUBLISHER}.`
  const flavour = template.description?.trim()
  return {
    path: `/starter/${kind}/${template.id}`,
    title: pageTitle(`${template.name} · Starter Set ${label}`),
    description: flavour ? `${intro} ${flavour}` : intro,
  }
}

/** A build's page by its route params, or null when the Starter Set has no such build. */
export function starterPage(kind: string, id: string): StarterPage | null {
  if (!isStarterKind(kind)) return null
  const template = starterTemplate(kind, id)
  return template === null ? null : pageOf(kind, template)
}

/** Every build's page, pilots first, as the Starter Set lists them. */
export function starterPages(): StarterPage[] {
  return STARTER_KINDS.flatMap((kind) => templatesOf(kind).map((t) => pageOf(kind, t)))
}

/** The Starter Set roster's own title, and any build's page that names nothing. */
export const STARTER_SET_TITLE = pageTitle('Starter Set')

/** A build's tab title by its route params; the Starter Set's own for one it does not hold. */
export function starterPageTitle(kind: string, id: string): string {
  return starterPage(kind, id)?.title ?? STARTER_SET_TITLE
}
