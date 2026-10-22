import type { Page } from '@playwright/test'

/**
 * Nothing beside or under a strip (hard rule R6; `chips-and-actions.md` C1,
 * C8; EDL E8) as the rendered page draws it. In every entity list item, every
 * control belongs to an entity and sits in that entity's chip group
 * (`[data-chip-group]`, `Chips`): its state, uses and actions inlined last,
 * after the cost. `findStripControlFaults` returns one per control that does
 * not:
 *
 * - **beside** a control on an entity's head (its band, a Mini's pill) but
 *   outside its chip group, or in the list item beside the entity: Play's Use
 *   on its own line above the chips.
 * - **under** a control in the entity's body: something that expands under
 *   the strip (Details opens the Page instead).
 *
 * And outside the item: a control drawn as the sibling right before or after
 * an entity's list item (or, in a slot, the entity with the wrappers that hold
 * it alone, up to a sectioning element) in the same list or slot wrapper is
 * `beside` it, or `under` it when it starts below it (a Starter Set Compact's
 * "Copy to…" select once was). An entity nested in another, or in a Card, is
 * its parent's: what sits beside it is the parent's own.
 *
 * An entity's own surface is not one of its controls: the link or radio the
 * Compact or Mini is (or its cover, or a Mini with controls' name), a link that wraps its head, and a select
 * Compact's check. What of a head's chips did not fit beside its name is its
 * body's first row (`[data-chip-overflow]`, C2b): its chip group still. A contentful
 * Mini's body holds its host's content and, in Edit, its fields (a crew
 * lead's name, keepsake and facts: `MiniBody`), which are no strip's. A
 * nested entity's controls are that entity's, held to its own chip group.
 */
export type StripControlSelectors = {
  /** A list item: an `li`, an ARIA list item or option. */
  item: string
  /** What the gate reads as a control. */
  control: string
  /** An entity's frame: a Compact (a `TitledBox` line too), a Mini, a CompactIndex. */
  entity: string
  /** The entity's own surface: its cover, a contentful Mini's head. */
  surface: string
  /** An entity's head: what a control beside the strip sits on. */
  head: string
  /** The chip group, and its body's overflow row (C2b). */
  group: string
  /** A select Compact's check, the mode's own control (N7). */
  check: string
  /** A contentful Mini's body: its host's content and, in Edit, its fields. */
  body: string
  /** A Card's frame: an entity nested in it is the Card's, its controls the Card's. */
  card: string
  /**
   * A `MiniGroup`: an entity's Mini and the Minis that belong to it in one
   * border. A control in it outside every Mini (its When Damaged's fold, a
   * choice) is the group's own section, as a Card's body is the Card's.
   */
  tokenGroup: string
  /** A sectioning wrapper: a slot ends at it, so the sibling scan never climbs past it. */
  section: string
}

export const STRIP_CONTROL_SELECTORS: StripControlSelectors = {
  item: 'li, [role="listitem"], [role="option"]',
  control: [
    'button',
    'a[href]',
    '[role="button"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[role="switch"]',
    '[role="tab"]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
  ].join(', '),
  entity: '.su-entity-compact, .su-entity-mini, .su-entity-index',
  surface: '.su-entity-compact__cover, .su-entity-mini__head, .su-entity-mini__link',
  head: '.su-entity-compact__head, .su-entity-mini__pill, .su-entity-index__band',
  group: '[data-chip-group], [data-chip-overflow]',
  check: '.su-entity-compact__head input[type="checkbox"]',
  body: '.su-entity-mini[data-contentful] > .su-entity-mini__body',
  card: '.su-ec-frame',
  tokenGroup: '.su-mini-group',
  section:
    'section, article, aside, nav, main, header, footer, form, dialog, fieldset, [role="region"], [role="tabpanel"], [role="dialog"]',
}

/**
 * Runs in the page and returns plain data, so it closes over nothing: every
 * helper is declared inside it, and the selectors come in as its argument.
 */
export function scanStripControls(a: StripControlSelectors): string[] {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const visible = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  const nameOf = (entity: Element) =>
    text(
      entity.querySelector(
        '.su-entity-compact__title, .su-entity-mini__name, .su-entity-index__name'
      )
    ).slice(0, 40) || text(entity).slice(0, 40)
  const describe = (el: Element) => {
    const label = (el.getAttribute('aria-label') ?? text(el)).slice(0, 32)
    return `${el.tagName.toLowerCase()} "${label}"`
  }
  const faults = new Set<string>()
  for (const item of document.querySelectorAll(a.item)) {
    if (!visible(item)) continue
    // An item that is itself an entity, or holds one.
    const holds = item.matches(a.entity) || item.querySelector(a.entity) !== null
    if (!holds) continue
    for (const control of item.querySelectorAll(a.control)) {
      if (!visible(control)) continue
      // The entity's own surface: the link or radio it is, its cover, a check,
      // or a link that wraps a head (a hand-built frame's, R35's debt).
      if (
        control.matches(a.entity) ||
        control.matches(a.surface) ||
        control.matches(a.check) ||
        control.closest(a.body) !== null ||
        control.querySelector(a.head) !== null
      ) {
        continue
      }
      const entity = control.closest(a.entity)
      if (!entity) {
        const group = control.closest(a.tokenGroup)
        if (group && item.contains(group)) continue
      }
      if (!entity || !item.contains(entity)) {
        // Beside the entity, in its list item.
        const first = item.matches(a.entity) ? item : item.querySelector(a.entity)
        faults.add(`beside: ${describe(control)} beside “${first ? nameOf(first) : '?'}”`)
        continue
      }
      const group = control.closest(a.group)
      if (group && group.closest(a.entity) === entity) continue
      const head = control.closest(a.head)
      const where = head && head.closest(a.entity) === entity ? 'beside' : 'under'
      faults.add(
        `${where}: ${describe(control)} ${where === 'beside' ? 'beside' : 'under'} the strip of “${nameOf(entity)}”`
      )
    }
  }
  // Beside the item: a control drawn right before or after an entity's list
  // item (or, in a slot, the entity itself), a sibling in the same list or
  // slot wrapper (a Starter Set Compact's "Copy to…" under it). It is `under`
  // when it starts below the item, else `beside`.
  const nearest = (from: Element, step: 'previousElementSibling' | 'nextElementSibling') => {
    let el = from[step]
    while (el && !visible(el)) el = el[step]
    return el
  }
  for (const entity of document.querySelectorAll(a.entity)) {
    if (!visible(entity)) continue
    // A nested entity's place is its parent's strip, held above (a Card's too).
    if (entity.parentElement?.closest(`${a.entity}, ${a.card}`)) continue
    // Its list item; in a slot, the entity with every wrapper that holds it alone.
    let unit = entity.closest(a.item)
    if (!unit) {
      unit = entity
      while (unit.parentElement && unit.parentElement !== document.body) {
        if (unit.parentElement.children.length !== 1) break
        if (unit.parentElement.matches(a.section)) break
        unit = unit.parentElement
      }
    }
    const box = unit.getBoundingClientRect()
    for (const step of ['previousElementSibling', 'nextElementSibling'] as const) {
      const sibling = nearest(unit, step)
      if (!sibling) continue
      // Another entity (or its item): the next line of the list.
      if (sibling.matches(a.entity) || sibling.querySelector(a.entity) !== null) continue
      const controls = [
        ...(sibling.matches(a.control) ? [sibling] : []),
        ...sibling.querySelectorAll(a.control),
      ]
      for (const control of controls) {
        if (!visible(control)) continue
        const where = control.getBoundingClientRect().top >= box.bottom - 1 ? 'under' : 'beside'
        faults.add(`${where}: ${describe(control)} ${where} “${nameOf(entity)}”, a sibling`)
      }
    }
  }
  return [...faults]
}

/** Every control in an entity list item outside its entity's chip group. */
export function findStripControlFaults(page: Page): Promise<string[]> {
  return page.evaluate(scanStripControls, STRIP_CONTROL_SELECTORS)
}
