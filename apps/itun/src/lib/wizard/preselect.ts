/**
 * Preselection — the `/…/new` routes' deep-link params from an SRD entity
 * page's "Build with this" button: `/mechs/new?chassis=mule`,
 * `/pilots/new?class=salvager`, `/crawlers/new?type=battle-crawler`.
 *
 * Each param is an entity SLUG (never a UUID), and a wizard honours it only
 * when it names a starting-legal pick — the same filters its own pickers
 * apply (Tech 1 chassis, core classes, any crawler type). Anything else is
 * dropped, so a hand-edited URL can't seed an option the wizard would never
 * offer. A stored draft wins: the param fills the pick only while the draft's
 * is still empty, so following a link never clobbers a build in progress.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationChassis, isLegalCreationClass } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'

/** A slug's shape: what `nameToSlug` can produce, and nothing that could be a path. */
const SLUG = /^[a-z0-9][a-z0-9_-]*$/

/** Narrow a raw search param to a slug-shaped string (routes' validateSearch). */
export function parseSlugParam(value: unknown): string | undefined {
  return typeof value === 'string' && SLUG.test(value) ? value : undefined
}

/** The mech wizard's chassis ref for `?chassis=`: the slug, if it is a Tech 1 chassis. */
export function preselectedChassis(slug: string | undefined): string | undefined {
  if (slug === undefined) return undefined
  const chassis = readReference(
    'preselect.chassis',
    () => SalvageUnionReference.Chassis.getBySlug(slug),
    undefined
  )
  return chassis && isLegalCreationChassis(chassis.techLevel) ? slug : undefined
}

/** The pilot wizard's class id for `?class=`: the class's id, if it is a core class. */
export function preselectedClassId(slug: string | undefined): string | undefined {
  if (slug === undefined) return undefined
  const cls = readReference(
    'preselect.class',
    () => SalvageUnionReference.Classes.getBySlug(slug),
    undefined
  )
  return cls && 'coreTrees' in cls && isLegalCreationClass(cls.coreTrees) ? cls.id : undefined
}

/** The crawler wizard's type ref for `?type=`: the slug, if it names a crawler type. */
export function preselectedCrawlerType(slug: string | undefined): string | undefined {
  if (slug === undefined) return undefined
  const type = readReference(
    'preselect.crawler',
    () => SalvageUnionReference.Crawlers.getBySlug(slug),
    undefined
  )
  return type ? slug : undefined
}

/**
 * Seed `field` with `value` while the form's own pick is still empty (`''` or
 * `null`); otherwise the form — a restored draft — is returned unchanged.
 */
export function withPreselection<F, K extends keyof F>(
  form: F,
  field: K,
  value: F[K] | undefined
): F {
  if (value === undefined) return form
  const current = form[field]
  if (current !== '' && current !== null) return form
  return { ...form, [field]: value }
}
