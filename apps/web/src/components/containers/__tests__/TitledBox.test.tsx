import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { TitledBox } from '../TitledBox'

describe('TitledBox', () => {
  test('puts its title on the cut-out of an ink band, over a padded paper body', () => {
    const { container } = render(
      <TitledBox title="The Rule">
        <p>Body</p>
      </TitledBox>
    )
    const head = container.querySelector('.su-entity-row__head[data-notch]')
    expect(head?.getAttribute('data-fill')).toBe('ink')
    expect(head?.querySelector('.su-entity-row__notch')?.textContent).toBe('The Rule')
    const body = container.querySelector('.su-box__body')
    expect(body?.textContent).toBe('Body')
    expect(body?.hasAttribute('data-flush')).toBe(false)
  })

  test('paints its tone, and carries chips and controls in one chip group on the band', () => {
    const { container } = render(
      <TitledBox
        title="Hold"
        tone="mech"
        chips={<span className="su-chips">SLOTS | 3</span>}
        controls={<button type="button">Close</button>}
      >
        Body
      </TitledBox>
    )
    const head = container.querySelector<HTMLElement>('.su-entity-row__head')
    expect(head?.style.backgroundColor).toBe('var(--color-mech)')
    expect(head?.textContent).toContain('SLOTS | 3')
    // The controls are the chip group's last slot (C8, R6), after its chips.
    const close = head?.querySelector('[data-chip-group] [data-chip-class="menu"] button')
    expect(close?.textContent).toBe('Close')
  })

  test('closes on its head with no body, and is a named section on request', () => {
    const { container } = render(<TitledBox as="section" title="Mech Hold" label="Hold" />)
    expect(container.querySelector('[data-bodyless]')).not.toBeNull()
    expect(container.querySelector('.su-box__body')).toBeNull()
    expect(screen.getByRole('region', { name: 'Hold' })).toBeTruthy()
  })

  test('flush drops the body padding; role and classes reach the root', () => {
    const { container } = render(
      <TitledBox title="Killed in Action" role="alert" className="extra" body="flush">
        Text
      </TitledBox>
    )
    const root = container.firstElementChild
    expect(root?.getAttribute('role')).toBe('alert')
    expect(root?.classList.contains('extra')).toBe(true)
    expect(container.querySelector('.su-box__body')?.hasAttribute('data-flush')).toBe(true)
  })
})
