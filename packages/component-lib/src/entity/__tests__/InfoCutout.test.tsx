import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { InfoCutout } from '../InfoCutout'

describe('InfoCutout', () => {
  test("is a Row's block: cut-out name, chips beside it, a paper body", () => {
    const { container } = render(
      <InfoCutout
        title="Mule"
        label="Chassis"
        fill="mech"
        facts={[{ key: 'sp', label: 'Structure Points', value: '12' }]}
        aside={<span>meta</span>}
      >
        <p>Body</p>
      </InfoCutout>
    )
    const panel = container.querySelector('section[aria-label="Chassis"]')
    expect(panel?.querySelector('.su-entity-row__head[data-notch]')).not.toBeNull()
    expect(panel?.textContent).toContain('Structure Points')
    expect(panel?.textContent).toContain('meta')
    expect(panel?.querySelector('.su-info-cutout__body')?.textContent).toBe('Body')
  })

  test('ink by default, bodyless and flush on request', () => {
    const { container, rerender } = render(<InfoCutout title="Mech Hold" />)
    expect(container.querySelector('[data-bodyless]')).not.toBeNull()
    expect(container.querySelector('.su-entity-row__head')?.getAttribute('data-fill')).toBe('ink')
    rerender(
      <InfoCutout title="Mech Hold" flush>
        <p>Strip</p>
      </InfoCutout>
    )
    expect(container.querySelector('.su-info-cutout__body')?.hasAttribute('data-flush')).toBe(true)
  })
})
