import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { NESTING_SELECTORS } from './_nestingDepth'

/**
 * The form fits the place (hard rule R35; EDL E2, E11, E19) as the rendered
 * page draws it. `findFormFindings` reads the page and returns each place it
 * breaks:
 *
 * - **E2** a list item that holds an entity draws it as something other than
 *   a Row, a Tile or a Token: a Card, a hand-built headed frame, or a bare
 *   link to a unit's sheet. The entity is the item's outermost entity markup.
 * - **E11** a lead (`Lead`, `.su-entity-lead`) off an SRD index.
 * - **E19** a chassis ability drawn anywhere but on its chassis or pattern
 *   Page at level 1, or the mech sheet's hero, unless as a contentful Token.
 *
 * A Mention is prose, not a list's entity, so it is not read.
 */
export type FormFinding = {
  rule: 'E2' | 'E11' | 'E19'
  /** What breaks it, `a Card (Hover Drone (Action)) in a list item`. */
  detail: string
}

export type FormSelectors = {
  /** A list item: an `li`, an ARIA list item or option. */
  item: string
  /** A Row (not a TitledBox, which shares its class), a Tile, a Token. */
  row: string
  tile: string
  token: string
  /** A Card (`ReferenceEntityCard`). */
  card: string
  /** A headed frame built outside `entity/` (a class path, a choice option). */
  handFrame: string
  /** A link to a unit's Live Sheet. */
  unitLink: string
  head: string
  frame: string
  title: string
  tokenName: string
  lead: string
  /** A Peek's plate: never an index, whatever the page under it. */
  peek: string
  /** The mech sheet's hero, where a chassis ability is a level-1 Row (E19). */
  mechHero: string
}

export const FORM_SELECTORS: FormSelectors = {
  item: 'li, [role="listitem"], [role="option"]',
  row: '.su-entity-row:not(.su-box)',
  tile: '.su-entity-tile',
  token: '.su-entity-token',
  card: '.su-ec-outer',
  handFrame: '.su-class-path, [data-option-frame]',
  unitLink: 'a[href*="/sheet/"]',
  head: NESTING_SELECTORS.head,
  frame: NESTING_SELECTORS.frame,
  title: NESTING_SELECTORS.title,
  tokenName: NESTING_SELECTORS.tokenName,
  lead: '.su-entity-lead',
  peek: '[data-peek-popup]',
  mechHero: '.su-sheet-mech-hero-chassis',
}

/** Every chassis ability's name, from the reference data. */
export function chassisAbilityNames(): string[] {
  const file = join(
    import.meta.dirname,
    '../../../packages/salvageunion-reference/data/chassis.json'
  )
  const chassis = JSON.parse(readFileSync(file, 'utf8')) as { chassisAbilities?: string[] }[]
  return [...new Set(chassis.flatMap((c) => c.chassisAbilities ?? []))].sort()
}

/** Where a scan runs: may it draw a lead, and a chassis ability at level 1? */
export type FormPlace = { index: boolean; chassisPage: boolean }

/**
 * Runs in the page and returns plain data, so it closes over nothing: every
 * helper is declared inside it, and the selectors come in as its argument.
 */
export function scanForms({
  a,
  place,
  abilities,
}: {
  a: FormSelectors
  place: FormPlace
  abilities: string[]
}): FormFinding[] {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const visible = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  /** A rendering's name: its Token's name or its head's title, kind and all. */
  const nameOf = (el: Element) =>
    (el.matches(a.token) ? text(el.querySelector(a.tokenName)) : '') ||
    text(el.querySelector(a.title)) ||
    text(el.querySelector(a.head)).slice(0, 40) ||
    text(el).slice(0, 40)
  const found: FormFinding[] = []

  // E2: a list item's entity is a Row, a Tile or a Token.
  const entity = [a.row, a.tile, a.token, a.card, a.handFrame, a.unitLink].join(', ')
  for (const item of document.querySelectorAll(a.item)) {
    if (!visible(item)) continue
    const inner = [...item.querySelectorAll(entity)].filter(visible)
    if (item.matches(a.handFrame)) inner.unshift(item)
    const outermost = inner.filter((el) => !inner.some((o) => o !== el && o.contains(el)))
    for (const el of outermost) {
      if (el.matches(a.row) || el.matches(a.tile) || el.matches(a.token)) continue
      if (el.closest(a.token) || el.closest(a.row) || el.closest(a.tile)) continue
      const what = el.matches(a.card)
        ? 'a Card'
        : el.matches(a.handFrame)
          ? 'a hand-built frame'
          : 'a bare unit link'
      found.push({ rule: 'E2', detail: `${what} (${nameOf(el)}) in a list item` })
    }
  }

  // E11: a lead only on an SRD index (never on a Peek's plate over one).
  for (const lead of document.querySelectorAll(a.lead)) {
    if (!visible(lead)) continue
    if (place.index && !lead.closest(a.peek)) continue
    const host = lead.closest(`${a.row}, ${a.tile}, ${a.handFrame}`) ?? lead.parentElement
    found.push({ rule: 'E11', detail: `a lead in ${host ? nameOf(host) : 'a block'}` })
  }

  // E19: a chassis ability at level 1 only on its pages and the mech hero;
  // else a contentful Token.
  const isAbility = (name: string) => abilities.some((n) => name === n || name.startsWith(`${n} (`))
  const frames = new Set<Element>()
  for (const head of document.querySelectorAll(a.head)) {
    if (!visible(head)) continue
    frames.add(head.closest(a.frame) ?? head)
  }
  for (const frame of frames) {
    const name = text(frame.querySelector(a.title))
    if (!isAbility(name)) continue
    if (frame.closest(a.token)) continue
    if (frame.closest(a.mechHero)) continue
    const level = [...frames].filter((f) => f !== frame && f.contains(frame)).length + 1
    if (place.chassisPage && level === 1) continue
    found.push({
      rule: 'E19',
      detail: `the chassis ability ${name} as a level-${level} frame`,
    })
  }
  for (const token of document.querySelectorAll(a.token)) {
    if (!visible(token)) continue
    const name = text(token.querySelector(a.tokenName))
    if (!isAbility(name)) continue
    if (token.closest(`${a.token}[data-contentful]`)) continue
    found.push({ rule: 'E19', detail: `the chassis ability ${name} as a header-only Token` })
  }
  return found
}

export function findFormFindings(
  page: Page,
  place: FormPlace,
  abilities: string[]
): Promise<FormFinding[]> {
  return page.evaluate(scanForms, { a: FORM_SELECTORS, place, abilities })
}
