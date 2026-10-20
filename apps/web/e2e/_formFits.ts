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
 *   a Compact, a CompactIndex or a Mini: a Card, a hand-built headed frame, or a bare
 *   link to a unit's sheet. The entity is the item's outermost entity markup.
 *   On a Live Sheet every item of its lists is a Mini or a Compact, entity or not
 *   (ruleset §6.6): a carried thing the reference does not hold (a generic
 *   entry, a cargo lot) is a Mini from a synthetic model, never a panel.
 * - **E11** a lead (`Lead`, `.su-entity-lead`) off an SRD index.
 * - **E19** a chassis ability drawn anywhere but on its chassis or pattern
 *   Page at level 1, or the mech sheet's hero, unless as a contentful Mini.
 * - **E3** Play's lists are Minis (ruleset §1.3, ADR-051 §6): a line of one
 *   of Play's lists (`[data-play-list]`: the Actions, the Crew and the
 *   Mediator's seats, the Tables) that is no Mini, or holds a Compact or a
 *   TitledBox (`.su-entity-compact`), a listing Compact where a Mini goes. On a Play
 *   route a page that marks no list fails too, so the gate never passes by
 *   finding nothing to read.
 *
 * A Mention is prose, not a list's entity, so it is not read.
 */
export type FormFinding = {
  rule: 'E2' | 'E3' | 'E11' | 'E19'
  /** What breaks it, `a Card (Hover Drone (Action)) in a list item`. */
  detail: string
}

export type FormSelectors = {
  /** A list item: an `li`, an ARIA list item or option. */
  item: string
  /**
   * An item of a Live Sheet's lists: its `li`s and its item lines' children (a
   * line's sr-only live region is none). A `StatColumn`'s cell is none either:
   * the column is a layout of `Stat`s (the mech hero's chassis stats), not a
   * list of things carried or installed.
   */
  sheetItem: string
  /** A Compact (not a TitledBox, which shares its class), a CompactIndex, a Mini. */
  row: string
  tile: string
  token: string
  /** A Card (`ReferenceEntityCard`). */
  card: string
  /** A headed frame built outside `entity/` (a choice option). */
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
  /** The mech sheet's hero, where a chassis ability is a level-1 Compact (E19). */
  mechHero: string
  /** One of Play's lists, each line a Mini (E3). */
  playList: string
  /** A Compact or a TitledBox, which shares its class: never a line of a Play list. */
  anyRow: string
}

export const FORM_SELECTORS: FormSelectors = {
  item: 'li, [role="listitem"], [role="option"]',
  sheetItem: [
    '.su-sheet-live-body li:not(.su-stat-column__cell)',
    '.su-sheet-live-body .su-sheet-items > :not(li, ul, .su-sr-only)',
    '.su-sheet-live-body .su-sheet-pills > *',
  ].join(', '),
  row: '.su-entity-compact:not(.su-box)',
  tile: '.su-entity-index',
  token: '.su-entity-mini',
  card: '.su-ec-outer',
  handFrame: '[data-option-frame]',
  unitLink: 'a[href*="/sheet/"]',
  head: NESTING_SELECTORS.head,
  frame: NESTING_SELECTORS.frame,
  title: NESTING_SELECTORS.title,
  tokenName: NESTING_SELECTORS.tokenName,
  lead: '.su-entity-lead',
  peek: '[data-peek-popup]',
  mechHero: '.su-sheet-mech-hero-chassis',
  playList: '[data-play-list]',
  anyRow: '.su-entity-compact',
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

/**
 * Where a scan runs: may it draw a lead, and a chassis ability at level 1?
 * Is it a Play screen, whose lists are Minis (E3)?
 */
export type FormPlace = { index: boolean; chassisPage: boolean; play: boolean }

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
  /** A rendering's name: its Mini's name or its head's title, kind and all. */
  const nameOf = (el: Element) =>
    (el.matches(a.token) ? text(el.querySelector(a.tokenName)) : '') ||
    text(el.querySelector(a.title)) ||
    text(el.querySelector(a.head)).slice(0, 40) ||
    text(el).slice(0, 40)
  const found: FormFinding[] = []

  // E2: a list item's entity is a Compact, a CompactIndex or a Mini.
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

  // E2, on a Live Sheet: every item of its lists is a Mini or a Compact.
  const line = [a.row, a.token].join(', ')
  for (const item of document.querySelectorAll(a.sheetItem)) {
    if (!visible(item)) continue
    if (item.matches(line) || item.closest(line)) continue
    if ([...item.querySelectorAll(line)].some(visible)) continue
    found.push({
      rule: 'E2',
      detail: `a sheet list item (${nameOf(item)}) that is no Mini or Compact`,
    })
  }

  // E3: Play's lists are Minis, one a line; never a Compact (or a TitledBox).
  const playLists = document.querySelectorAll(a.playList)
  if (place.play && playLists.length === 0)
    found.push({ rule: 'E3', detail: 'no Play list marked (data-play-list) on a Play screen' })
  for (const list of playLists) {
    if (!visible(list)) continue
    const label = list.getAttribute('aria-label') ?? 'a Play list'
    for (const line of list.querySelectorAll(':scope > li')) {
      if (!visible(line)) continue
      for (const row of line.querySelectorAll(a.anyRow)) {
        if (!visible(row)) continue
        found.push({ rule: 'E3', detail: `a Compact (${nameOf(row)}) in Play's ${label} list` })
      }
      if (![...line.querySelectorAll(a.token)].some(visible))
        found.push({
          rule: 'E3',
          detail: `a line (${nameOf(line)}) of Play's ${label} list that is no Mini`,
        })
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
  // else a contentful Mini.
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
    found.push({ rule: 'E19', detail: `the chassis ability ${name} as a header-only Mini` })
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
