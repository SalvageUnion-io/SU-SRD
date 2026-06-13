import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { MiniStat } from '../MiniStat'

afterEach(cleanup)

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
