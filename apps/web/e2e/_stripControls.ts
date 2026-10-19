import type { Page } from '@playwright/test'

/**
 * Nothing beside or under a strip (hard rule R6; `chips-and-actions.md` C1,
 * C8; EDL E8) as the rendered page draws it. In every entity list item, every
 * control belongs to an entity and sits in that entity's chip group
 * (`[data-chip-group]`, `Chips`): its state, uses and actions inlined last,
 * after the cost. `findStripControlFaults` returns one per control that does
 * not:
 *
 * - **beside** a control on an entity's head (its band, a Token's pill) but
 *   outside its chip group, or in the list item beside the entity: Play's Use
 *   on its own line above the chips.
 * - **under** a control in the entity's body: something that expands under
 *   the strip (Details opens the Page instead).
 *
 * An entity's own surface is not one of its controls: the link or radio the
 * Row or Token is (or its cover, or a Token with controls' name), a link that wraps its head, and a select
 * Row's check. A nested entity's
 * controls are that entity's, held to its own chip group.
 */
export type StripControlSelectors = {
  /** A list item: an `li`, an ARIA list item or option. */
  item: string
  /** What the gate reads as a control. */
  control: string
  /** An entity's frame: a Row (a `TitledBox` line too), a Token, a Tile. */
  entity: string
  /** The entity's own surface: its cover, a contentful Token's head. */
  surface: string
  /** An entity's head: what a control beside the strip sits on. */
  head: string
  /** The chip group. */
  group: string
  /** A select Row's check, the mode's own control (N7). */
  check: string
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
  entity: '.su-entity-row, .su-entity-token, .su-entity-tile',
  surface: '.su-entity-row__cover, .su-entity-token__head, .su-entity-token__link',
  head: '.su-entity-row__head, .su-entity-token__pill, .su-entity-tile__band',
  group: '[data-chip-group]',
  check: '.su-entity-row__head input[type="checkbox"]',
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
      entity.querySelector('.su-entity-row__title, .su-entity-token__name, .su-entity-tile__name')
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
        control.querySelector(a.head) !== null
      ) {
        continue
      }
      const entity = control.closest(a.entity)
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
  return [...faults]
}

/** Every control in an entity list item outside its entity's chip group. */
export function findStripControlFaults(page: Page): Promise<string[]> {
  return page.evaluate(scanStripControls, STRIP_CONTROL_SELECTORS)
}
