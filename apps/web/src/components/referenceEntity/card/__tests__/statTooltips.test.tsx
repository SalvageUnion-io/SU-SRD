/**
 * The card's HOVER EXPLANATIONS — the glossary reachable from a stat.
 *
 * Two affordances regressed when the card was unified, in the two places a card
 * states a rules term:
 *
 * - the SUB-HEADER trait line, which was flattened from per-trait cells to one
 *   joined string, taking every trait's hovercard with it (the same hovercard an
 *   in-prose `[[trait]]` reference still summons);
 * - the HEADER stat cluster in its COMPACT anatomy, where the `hoverText` the
 *   stat config supplies for every stat was dropped — so a stat explained itself
 *   on a large card and went silent on a listing or nested one.
 *
 * A stat's explanation is asserted through the trigger attribute base-ui
 * stamps on whatever it arms; a trait Tag's Peek through the address it
 * carries (`data-peek`), which the page's one PeekHost reads.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InsidePeekContext } from '../../../entity/peekContext'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const TRIGGER = '[data-base-ui-tooltip-trigger]'
const PEEK = '[data-peek]'

const action = (name: string) => {
  const found = SalvageUnionReference.Actions.getByName(name)
  if (!found) throw new Error(`${name} action fixture missing`)
  return found
}

const mule = () => {
  const found = SalvageUnionReference.Chassis.getByName('Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** The element whose whole text IS `text` — the segment/label, not its ancestors. */
const leafWithText = (text: string) =>
  screen.getAllByText((_, el) => el?.textContent === text).at(-1)

describe('trait tags (E17)', () => {
  test('each trait Tag Peeks its own entry', () => {
    render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    for (const name of ['Burn', 'Explosive', 'Heavy']) {
      expect(leafWithText(name)?.closest(PEEK)?.getAttribute('data-peek')).toStartWith('traits:')
    }
  })

  test('there is no "//" line: the traits are Tags with their parameter cells', () => {
    const { container } = render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    expect(container.textContent).not.toContain('//')
    const burn = leafWithText('Burn')?.parentElement
    expect(burn?.textContent).toBe('Burn2')
  })

  test('a segment naming no known entity stays plain text', () => {
    // An action's classification and its measured cells lead the line and are
    // not glossary terms — they must stay bare text nodes, not armed spans.
    const { container } = render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    const armed = [...container.querySelectorAll(`${TRIGGER}, ${PEEK}`)].map((el) => el.textContent)
    expect(armed).not.toContain('Turn Action')
    expect(armed).not.toContain('Range: Medium')
  })

  test('inside a Peek the line is inert — no nested Peek', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        <ReferenceEntityCard data={action('Beta Fission Gun')} size="compact" />
      </InsidePeekContext.Provider>
    )
    expect(container.querySelector(TRIGGER)).toBeNull()
    expect(container.querySelector(PEEK)).toBeNull()
  })
})

/**
 * The card's own element whose whole text IS `text`: the chassis's stat, not
 * a nested pattern Mini's chip of the same name.
 */
const bandLeaf = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('*')]
    .filter((el) => el.textContent === text && !el.closest('.su-entity-mini'))
    .at(-1)

describe('header stat cluster', () => {
  test('a COMPACT card explains its stats', () => {
    // The regression: `hoverText` reached the value box but never the compact
    // horizontal cell, so every listing and nested card lost its glossary.
    const { container } = render(<ReferenceEntityCard data={mule()} size="compact" />)
    expect(bandLeaf(container, 'SP')?.closest(TRIGGER)).toBeTruthy()
    // The compact budget (C3): a chassis keeps TL and SP; EP is the full card's.
    expect(bandLeaf(container, 'EP')).toBeFalsy()
  })

  test('a FULL card still explains its stats', () => {
    const { container } = render(<ReferenceEntityCard data={mule()} size="full" />)
    expect(bandLeaf(container, 'SP')?.closest(TRIGGER)).toBeTruthy()
  })
})
