/**
 * RailUnit — the pilot or mech on the Downtime rail: its lead pool is the
 * Dashboard's one gauge (`DashboardGauge`, the compact `VitalGauge`, §4.5 pip
 * split), never a hand-built pip track or a swatch; the rest are `[label |
 * value]` cells; the whole unit is one button that opens its controls.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { RailUnit } from '../RailUnit'

function renderUnit(onOpen = mock((_trigger: HTMLButtonElement) => undefined)) {
  render(
    <RailUnit
      kind="pilot"
      label="Pilot"
      readings={[
        { label: 'HP', value: 7, max: 10, pips: true },
        { label: 'TP', value: 2 },
      ]}
      onOpen={onOpen}
    />
  )
  return { onOpen, button: screen.getByRole('button', { name: 'Open Pilot: HP 7 of 10, TP 2' }) }
}

describe('RailUnit', () => {
  test('the pooled reading is the compact gauge, split into §4.5 rows', () => {
    const { button } = renderUnit()
    expect(screen.getByRole('img', { name: 'HP 7 of 10' })).toBeTruthy()
    // Ten pips split 5/5, seven of them lit.
    const pips = button.querySelectorAll('[data-pip]')
    expect(pips).toHaveLength(10)
    expect(button.querySelectorAll('[data-pip="on"]')).toHaveLength(7)
  })

  test('no swatch: nothing in the unit is a bare tone block', () => {
    const { button } = renderUnit()
    expect(button.querySelector('span[aria-hidden="true"]')).toBeNull()
  })

  test('a reading without pips is a label-first cell', () => {
    const { button } = renderUnit()
    const cells = [...button.querySelectorAll('.su-stat-cell')].map((c) => c.textContent)
    expect(cells).toEqual(['TP2'])
  })

  test('a press opens the controls, handing back the trigger', () => {
    const { onOpen, button } = renderUnit()
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledWith(button)
  })
})
