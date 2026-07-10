import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { MiniStat } from '../MiniStat'

afterEach(cleanup)

/** Narrow a possibly-null query result, failing the test loudly if absent. */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected element to be present')
  return value
}

describe('MiniStat', () => {
  test('renders label and value/max with pips when max ≤ 12', () => {
    const { container } = render(<MiniStat label="HP" value={7} max={10} stat="hp" />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('/10')).toBeTruthy()
    expect(container.querySelectorAll('[data-pip]').length).toBe(10)
    expect(container.querySelectorAll('[data-pip="on"]').length).toBe(7)
  })

  test('suppresses pips when max > 12 (number-only readout)', () => {
    const { container } = render(<MiniStat label="SP" value={24} max={30} stat="sp" />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
    expect(screen.getByText('24')).toBeTruthy()
    expect(screen.getByText('/30')).toBeTruthy()
  })

  test('renders pips at exactly max 12', () => {
    const { container } = render(<MiniStat label="HEAT" value={6} max={12} stat="heat" />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(12)
  })

  test('clamps value to max and 0', () => {
    render(<MiniStat label="AP" value={9} max={5} stat="ap" />)
    expect(screen.getByText('5')).toBeTruthy()
    cleanup()
    render(<MiniStat label="AP" value={-2} max={5} stat="ap" />)
    expect(screen.getByText('0')).toBeTruthy()
  })

  test('no max renders bare value without pips', () => {
    const { container } = render(<MiniStat label="TP" value={3} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
    expect(screen.getByText('3')).toBeTruthy()
  })

  test('exposes an accessible group label', () => {
    render(<MiniStat label="HP" value={7} max={10} stat="hp" />)
    expect(screen.getByRole('group', { name: 'HP 7 of 10' })).toBeTruthy()
  })
})

describe('MiniStat — heat escalation (U-1)', () => {
  test('below ~70% heat stays on the warn fill with no escalation', () => {
    const { container } = render(<MiniStat label="HEAT" value={6} max={10} stat="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBeNull()
    expect(root.className).toContain('border-ink')
    expect(container.querySelector('[data-pip].bg-status-bad')).toBeNull()
  })

  test('at >= ~70% the lit pips past the line and the value go status-bad', () => {
    const { container } = render(<MiniStat label="HEAT" value={8} max={10} stat="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBe('high')
    const pips = Array.from(container.querySelectorAll('[data-pip]'))
    const danger = pips.filter((p) => p.className.includes('bg-status-bad'))
    expect(danger.length).toBe(2)
    expect(pips.indexOf(must(danger[0]))).toBe(6)
    expect(screen.getByText('8').className).toContain('text-status-bad')
    // border only escalates at cap
    expect(root.className).toContain('border-ink')
  })

  test('at cap the chip gets the red border + pulse', () => {
    render(<MiniStat label="HEAT" value={10} max={10} stat="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBe('critical')
    expect(root.className).toContain('border-status-bad')
    expect(root.className).toContain('motion-safe:animate-heat-pulse')
  })

  test('number-only readout (max > 12) still reads danger via the value', () => {
    const { container } = render(<MiniStat label="HEAT" value={20} max={20} stat="heat" />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBe('critical')
    expect(root.className).toContain('border-status-bad')
    expect(screen.getByText('20').className).toContain('text-status-bad')
  })

  test('inert without a max and for non-heat tones at cap', () => {
    render(<MiniStat label="HEAT" value={9} stat="heat" />)
    expect(screen.getByRole('group').getAttribute('data-heat')).toBeNull()
    cleanup()
    render(<MiniStat label="HP" value={10} max={10} stat="hp" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBeNull()
    expect(root.className).toContain('border-ink')
  })
})
