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
 * Both are asserted through the trigger attribute base-ui stamps on whatever it
 * arms, since the popup itself only mounts on hover.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InsideTooltipContext } from '../../../ui/insideTooltipContext'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const TRIGGER = '[data-base-ui-tooltip-trigger]'

const action = (name: string) => {
  const found = SalvageUnionReference.Actions.all().find((a) => a.name === name)
  if (!found) throw new Error(`${name} action fixture missing`)
  return found
}

const mule = () => {
  const found = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** The element whose whole text IS `text` — the segment/label, not its ancestors. */
const leafWithText = (text: string) =>
  screen.getAllByText((_, el) => el?.textContent === text).at(-1)

describe('sub-header trait line', () => {
  test('each trait segment arms its own hovercard', () => {
    render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    for (const segment of ['Burn (2)', 'Explosive (2)', 'Heavy', 'Uses (3)']) {
      expect(leafWithText(segment)?.closest(TRIGGER)).toBeTruthy()
    }
  })

  test('arming the segments does not change what the line reads', () => {
    // The trait line is book-fidelity text, not a row of stamps — restoring the
    // hovercards must leave the " // " reading byte-identical.
    const { container } = render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain('Burn (2) // Explosive (2) // Heavy // Uses (3)')
  })

  test('a segment naming no known entity stays plain text', () => {
    // An action's classification and its measured cells lead the line and are
    // not glossary terms — they must stay bare text nodes, not armed spans.
    const { container } = render(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    const armed = [...container.querySelectorAll(TRIGGER)].map((el) => el.textContent)
    expect(armed).not.toContain('Turn Action')
    expect(armed).not.toContain('Range: Medium')
  })

  test('inside a hovercard the line is inert — no nested hovercards', () => {
    const { container } = render(
      <InsideTooltipContext.Provider value={true}>
        <ReferenceEntityCard data={action('Beta Fission Gun')} size="medium" extent="catalog" />
      </InsideTooltipContext.Provider>
    )
    expect(container.querySelector(TRIGGER)).toBeNull()
  })
})

describe('header stat cluster', () => {
  test('a COMPACT card explains its stats', () => {
    // The regression: `hoverText` reached the value box but never the compact
    // horizontal cell, so every listing and nested card lost its glossary.
    render(<ReferenceEntityCard data={mule()} size="medium" />)
    expect(leafWithText('SP')?.closest(TRIGGER)).toBeTruthy()
    expect(leafWithText('EP')?.closest(TRIGGER)).toBeTruthy()
  })

  test('a FULL card still explains its stats', () => {
    render(<ReferenceEntityCard data={mule()} size="large" />)
    expect(leafWithText('Structure')?.closest(TRIGGER)).toBeTruthy()
  })
})
