/**
 * "Build With This" — the deep link from an SRD entity page into ITUN's
 * builder, preselecting the entity: a chassis page opens the mech wizard on
 * that chassis, a class page the pilot wizard on that class, a crawler page
 * the crawler wizard on that type. ITUN's `/…/new` routes read the slug
 * (`apps/itun/src/lib/wizard/preselect.ts`) and keep it through sign-in.
 *
 * Offered only where the wizard would accept the pick — a Tech 1 chassis, a
 * core class, any crawler type — by the same rules its pickers filter on, so
 * the button never lands on a wizard that silently ignores it.
 *
 * A creation guide ends on its exits (`guideExitsFor`): the same wizard, unseeded,
 * the next guide, and the Starter Set.
 *
 * The origin is `ITUN_URL`, the one the Union bar's Build link uses, so moving
 * ITUN (salvageunion.io/build) is that one constant.
 */

import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getEntitySlug, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  isLegalCreationChassis,
  isLegalCreationClass,
  isLegalStartingPattern,
} from 'salvageunion-reference/rules'
import { ITUN_URL } from './constants'
import { itemHref } from './entityHref'

/**
 * A build link: its visible `label`, and, where the label leaves out what is
 * built, an `ariaLabel` that starts with the label and names it (WCAG 2.5.3,
 * label in name): "Build With This: a mech".
 */
export type BuildLink = { href: string; label: string; ariaLabel?: string }

/** The page action's one visible label, whatever it builds (owner's call, 2026-10-13). */
const BUILD_WITH_THIS = 'Build With This'

/** `ITUN_URL` + a path in ITUN (`/starter`, `/mechs/new`). */
function itunHref(path: string): string {
  return `${ITUN_URL.replace(/\/$/, '')}${path}`
}

/**
 * `ITUN_URL` + a `/…/new` path, opened straight on the guided wizard, with
 * `param` preselected when there is one.
 */
function wizardHref(path: string, preselect: Record<string, string> = {}): string {
  const search = new URLSearchParams({ mode: 'guided', ...preselect })
  return `${itunHref(path)}?${search}`
}

/**
 * ITUN's Starter Set (`/starter`): Leyline Press's pre-generated crew, open
 * signed out — the fastest way to the table.
 */
export const STARTER_SET_HREF = itunHref('/starter')

/** The page's "Build With This" link, or `null` where there is nothing to build from it. */
export function buildLinkFor(schemaId: string, item: SURefEntity): BuildLink | null {
  const slug = getEntitySlug(item)
  switch (schemaId) {
    case 'chassis':
      return 'techLevel' in item &&
        item.techLevel !== undefined &&
        isLegalCreationChassis(item.techLevel)
        ? {
            href: wizardHref('/mechs/new', { chassis: slug }),
            label: BUILD_WITH_THIS,
            ariaLabel: `${BUILD_WITH_THIS}: a mech`,
          }
        : null
    case 'classes':
      return 'coreTrees' in item && isLegalCreationClass(item.coreTrees)
        ? {
            href: wizardHref('/pilots/new', { class: slug }),
            label: BUILD_WITH_THIS,
            ariaLabel: `${BUILD_WITH_THIS}: a pilot`,
          }
        : null
    case 'crawlers':
      return {
        href: wizardHref('/crawlers/new', { type: slug }),
        label: BUILD_WITH_THIS,
        ariaLabel: `${BUILD_WITH_THIS}: a crawler`,
      }
    default:
      return null
  }
}

/**
 * A pattern page's "Build this mech": the mech wizard on the pattern's chassis
 * with the pattern's loadout prefilled (`/mechs/new?chassis=mule&pattern=hauler`).
 * Offered only for a pattern the wizard's own pattern strip offers — a
 * `legalStarting` pattern of a Tech 1 chassis — so a Bio-Titan's or a
 * higher-tech pattern has none.
 */
export function patternBuildLinkFor(
  schemaId: string,
  host: SURefEntity,
  pattern: SURefObjectAnyPattern
): BuildLink | null {
  if (schemaId !== 'chassis' || !('techLevel' in host) || host.techLevel === undefined) return null
  if (!isLegalCreationChassis(host.techLevel)) return null
  if (!('legalStarting' in pattern) || !isLegalStartingPattern(pattern.legalStarting)) return null
  return {
    href: wizardHref('/mechs/new', {
      chassis: getEntitySlug(host),
      pattern: nameToSlug(pattern.name),
    }),
    label: 'Build this mech',
  }
}

/**
 * Where a creation guide sends its reader when it ends (the book closes each
 * chapter opener on an exit arrow): into ITUN's wizard for what the guide
 * builds, on to the next guide in the order a new crew walks them, or straight
 * to the Starter Set.
 */
export type GuideExits = {
  build: BuildLink
  /** The next creation guide; the last of them has none. */
  next: BuildLink | null
  starterSet: BuildLink
}

/** The creation guides, by `guideType`, in the order a new crew walks them. */
const CREATION_GUIDES = [
  { guideType: 'character-creation', build: { path: '/pilots/new', label: 'Build a pilot' } },
  { guideType: 'mech-creation', build: { path: '/mechs/new', label: 'Build a mech' } },
  { guideType: 'crawler-creation', build: { path: '/crawlers/new', label: 'Build a crawler' } },
] as const

/** A creation guide's exits, or `null` for any other page. */
export function guideExitsFor(schemaId: string, item: SURefEntity): GuideExits | null {
  if (schemaId !== 'guides' || !('guideType' in item)) return null
  const index = CREATION_GUIDES.findIndex((guide) => guide.guideType === item.guideType)
  const step = CREATION_GUIDES[index]
  if (!step) return null
  const following = CREATION_GUIDES[index + 1]
  const nextGuide = following
    ? SalvageUnionReference.findIn(
        'guides',
        (guide) => 'guideType' in guide && guide.guideType === following.guideType
      )
    : undefined
  return {
    build: { href: wizardHref(step.build.path), label: step.build.label },
    next: nextGuide
      ? { href: itemHref('guides', getEntitySlug(nextGuide)), label: `Next: ${nextGuide.name}` }
      : null,
    starterSet: { href: STARTER_SET_HREF, label: 'Or play the Starter Set' },
  }
}
