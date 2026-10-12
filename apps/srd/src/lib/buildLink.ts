/**
 * "Build with this" — the deep link from an SRD entity page into ITUN's
 * builder, preselecting the entity: a chassis page opens the mech wizard on
 * that chassis, a class page the pilot wizard on that class, a crawler page
 * the crawler wizard on that type. ITUN's `/…/new` routes read the slug
 * (`apps/itun/src/lib/wizard/preselect.ts`) and keep it through sign-in.
 *
 * Offered only where the wizard would accept the pick — a Tech 1 chassis, a
 * core class, any crawler type — by the same rules its pickers filter on, so
 * the button never lands on a wizard that silently ignores it.
 *
 * The origin is `ITUN_URL`, the one the Union bar's Build link uses, so moving
 * ITUN (salvageunion.io/build) is that one constant.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { isLegalCreationChassis, isLegalCreationClass } from 'salvageunion-reference/rules'
import { ITUN_URL } from './constants'

export type BuildLink = { href: string; label: string }

/** `ITUN_URL` + a `/…/new` path, opened straight on the guided wizard with `param` preselected. */
function wizardHref(path: string, param: string, slug: string): string {
  const search = new URLSearchParams({ mode: 'guided', [param]: slug })
  return `${ITUN_URL.replace(/\/$/, '')}${path}?${search}`
}

/** The page's "Build with this" link, or `null` where there is nothing to build from it. */
export function buildLinkFor(schemaId: string, item: SURefEntity): BuildLink | null {
  const slug = getEntitySlug(item)
  switch (schemaId) {
    case 'chassis':
      return 'techLevel' in item &&
        item.techLevel !== undefined &&
        isLegalCreationChassis(item.techLevel)
        ? { href: wizardHref('/mechs/new', 'chassis', slug), label: 'Build a mech with this' }
        : null
    case 'classes':
      return 'coreTrees' in item && isLegalCreationClass(item.coreTrees)
        ? { href: wizardHref('/pilots/new', 'class', slug), label: 'Build a pilot with this' }
        : null
    case 'crawlers':
      return { href: wizardHref('/crawlers/new', 'type', slug), label: 'Build a crawler with this' }
    default:
      return null
  }
}
