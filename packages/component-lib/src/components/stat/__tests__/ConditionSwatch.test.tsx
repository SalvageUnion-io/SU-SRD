import { describe, test, expect } from 'bun:test'
import { render } from '@testing-library/react'
import { ConditionSwatch } from '../ConditionSwatch'

describe('ConditionSwatch', () => {
  test('intact is a solid ok-toned square', () => {
    const { container } = render(<ConditionSwatch state="intact" />)
    const el = container.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('swatch rendered nothing')
    expect(el.className).toContain('bg-status-ok')
    expect(el.className).toContain('border-status-ok')
  })

  test('damaged is a hard clip-path half — never a gradient fill', () => {
    const { container } = render(<ConditionSwatch state="damaged" />)
    const fill = container.querySelector('[style*="clip-path"]')
    if (!(fill instanceof HTMLElement)) throw new Error('no clip-path fill rendered')
    expect(fill?.style.clipPath).toContain('polygon')
    // The no-gradient law (ruleset §3.5 / §7.1).
    expect(container.innerHTML).not.toContain('gradient')
  })

  test('destroyed renders an SVG ✕, no gradient', () => {
    const { container } = render(<ConditionSwatch state="destroyed" />)
    expect(container.querySelector('svg path')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('border-status-bad')
    expect(container.innerHTML).not.toContain('gradient')
  })
})
