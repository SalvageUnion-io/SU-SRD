import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { TitledBox } from '../TitledBox'

describe('TitledBox', () => {
  test('puts its title on the cut-out of an ink band, over a padded paper body', () => {
    const { container } = render(
      <TitledBox title="The Rule">
        <p>Body</p>
      </TitledBox>
    )
    const head = container.querySelector('.su-entity-compact__head[data-notch]')
    expect(head?.getAttribute('data-fill')).toBe('ink')
    expect(head?.querySelector('.su-entity-compact__notch')?.textContent).toBe('The Rule')
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
    const head = container.querySelector<HTMLElement>('.su-entity-compact__head')
    expect(head?.style.backgroundColor).toBe('var(--color-mech)')
    expect(head?.textContent).toContain('SLOTS | 3')
    // The controls are the chip group's last slot (C8, R6), after its chips.
    const close = head?.querySelector('[data-chip-group] [data-chip-class="menu"] button')
    expect(close?.textContent).toBe('Close')
  })

  test("frames its body in its band's colour, a head alone in none (R51)", () => {
    const { container } = render(
      <TitledBox title="Hold" tone="mech">
        Body
      </TitledBox>
    )
    const frame = container.querySelector<HTMLElement>('.su-entity-compact__frame')
    expect(frame?.style.getPropertyValue('--su-compact-frame')).toBe('var(--color-mech)')
    const ink = render(<TitledBox title="Rule">Body</TitledBox>).container
    expect(
      ink
        .querySelector<HTMLElement>('.su-entity-compact__frame')
        ?.style.getPropertyValue('--su-compact-frame')
    ).toBe('var(--color-ink)')
    const bare = render(<TitledBox title="Alone" tone="mech" />).container
    expect(
      bare
        .querySelector<HTMLElement>('.su-entity-compact__frame')
        ?.style.getPropertyValue('--su-compact-frame')
    ).toBe('')
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

  test('select mode: the box is the radio, selected it wears the ring and the seal (R15)', () => {
    const onSelect = mock(() => {})
    const pick = (selected: boolean) => (
      <TitledBox
        title="Start blank"
        select={{ kind: 'select', role: 'radio', selected, onSelect, label: 'Start blank' }}
      >
        No template.
      </TitledBox>
    )
    const { container, rerender } = render(pick(false))
    const radio = screen.getByRole('radio', { name: 'Start blank' })
    expect(radio.getAttribute('aria-checked')).toBe('false')
    expect(radio.classList.contains('su-box')).toBe(true)
    expect(screen.queryByText('Selected')).toBeNull()
    fireEvent.click(radio)
    expect(onSelect).toHaveBeenCalled()

    rerender(pick(true))
    expect(screen.getByRole('radio', { name: 'Start blank' }).getAttribute('aria-checked')).toBe(
      'true'
    )
    // The seal on the band's right, the ring on the solid frame.
    const head = container.querySelector('.su-entity-compact__head')
    expect(head?.textContent).toContain('Selected')
    const frame = container.querySelector<HTMLElement>('.su-entity-compact__frame')
    expect(frame?.style.boxShadow).toContain('3px')
    expect(frame?.hasAttribute('data-user-made')).toBe(false)
  })
})
