import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { VitalGauge } from '../VitalGauge'

/** Narrow a possibly-null query result, failing the test loudly if absent. */
function mustInput(el: HTMLElement | null | undefined): HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) throw new Error('expected an <input> element')
  return el
}

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected element to be present')
  return value
}

describe('VitalGauge — render', () => {
  test('renders label, numeral, max and default caption', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Max')).toBeTruthy()
  })

  test('editable gauge is a role=group with a summary label', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'HP 7 of 10' })).toBeTruthy()
  })

  test('renders one segment per max with correct on/off data-pip hooks', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'HP 7 of 10' })
    expect(group.querySelectorAll('[data-pip]').length).toBe(10)
    expect(group.querySelectorAll('[data-pip="on"]').length).toBe(7)
    expect(group.querySelectorAll('[data-pip="off"]').length).toBe(3)
  })

  test('accepts a caption override', () => {
    render(<VitalGauge label="SP" value={9} max={13} caption={['Structure', 'Max']} readOnly />)
    expect(screen.getByText('Structure')).toBeTruthy()
  })
})

describe('VitalGauge — click to set', () => {
  test('clicking the top-lit segment steps the value down (pipClickValue)', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={7} max={10} onChange={onChange} />)
    // Clicking segment 7 (index 6, currently the top-lit pip) sets HP to 6.
    fireEvent.click(screen.getByLabelText('Set HP to 7'))
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  test('clicking an unlit segment fills up to it', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={4} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Set HP to 9'))
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  test('clamps at the maximum', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="AP" value={4} max={5} onChange={onChange} />)
    // Clicking the last unlit segment fills to max 5.
    fireEvent.click(screen.getByLabelText('Set AP to 5'))
    expect(onChange).toHaveBeenLastCalledWith(5)
  })
})

describe('VitalGauge — keyboard', () => {
  test('ArrowUp / ArrowRight increment, ArrowDown / ArrowLeft decrement', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={5} max={10} onChange={onChange} />)
    const group = screen.getByRole('group', { name: 'HP 5 of 10' })
    fireEvent.keyDown(group, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(6)
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(group, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(10)
    fireEvent.keyDown(group, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  test('keyboard clamps at the bounds', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={0} max={10} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group', { name: 'HP 0 of 10' }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})

describe('VitalGauge — read-only', () => {
  test('renders role=img with non-interactive span segments', () => {
    render(<VitalGauge label="HP" value={7} max={10} readOnly />)
    const img = screen.getByRole('img', { name: 'HP 7 of 10' })
    expect(img.querySelectorAll('button').length).toBe(0)
    expect(img.querySelectorAll('span[data-pip]').length).toBe(10)
  })

  test('a value with onChange but readOnly is still non-interactive', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={7} max={10} onChange={onChange} readOnly />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getByRole('img', { name: 'HP 7 of 10' })).toBeTruthy()
  })

  test('read-only over-capacity renders extra red segments and flags the summary', () => {
    render(<VitalGauge label="Hold" value={13} max={10} readOnly />)
    const img = screen.getByRole('img', { name: 'Hold 13 of 10 — over capacity' })
    // 13 segments total (max 10 + 3 over); all lit.
    expect(img.querySelectorAll('[data-pip]').length).toBe(13)
    expect(img.querySelectorAll('[data-pip="on"]').length).toBe(13)
  })
})

describe('VitalGauge — cap override (ADR-022)', () => {
  test('without onMaxChange the max is a plain read-out (no override control)', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /override hp max/i })).toBeNull()
  })

  test('clicking the max opens an input; Enter commits the new max', () => {
    const onMaxChange = mock(() => {})
    render(
      <VitalGauge label="SP" value={9} max={13} onChange={() => {}} onMaxChange={onMaxChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /override sp max/i }))
    const input = mustInput(screen.getByLabelText('Set SP max'))
    fireEvent.change(input, { target: { value: '16' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // A trailing blur (fired when the input unmounts on Enter) must NOT commit
    // a second time — that would double the override write + change-log entry.
    fireEvent.blur(input)
    expect(onMaxChange).toHaveBeenCalledWith(16)
    expect(onMaxChange).toHaveBeenCalledTimes(1)
  })

  test('the revert control is hidden while the max is being edited', () => {
    render(
      <VitalGauge
        label="SP"
        value={9}
        max={16}
        onChange={() => {}}
        onMaxChange={() => {}}
        overriddenFrom={13}
        onRevertOverride={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /revert sp max to derived 13/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /override sp max/i }))
    // Editing the max: the revert affordance is gone (no conflicting write).
    expect(screen.queryByRole('button', { name: /revert sp max/i })).toBeNull()
  })

  test('Escape cancels without committing', () => {
    const onMaxChange = mock(() => {})
    render(
      <VitalGauge label="SP" value={9} max={13} onChange={() => {}} onMaxChange={onMaxChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /override sp max/i }))
    const input = mustInput(screen.getByLabelText('Set SP max'))
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onMaxChange).not.toHaveBeenCalled()
  })

  test('an overridden cap shows "overridden from N" and a one-click revert', () => {
    const onRevertOverride = mock(() => {})
    render(
      <VitalGauge
        label="SP"
        value={9}
        max={16}
        onChange={() => {}}
        onMaxChange={() => {}}
        overriddenFrom={13}
        onRevertOverride={onRevertOverride}
      />
    )
    expect(screen.getByText(/overridden from 13/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /revert sp max to derived 13/i }))
    expect(onRevertOverride).toHaveBeenCalledTimes(1)
  })

  test('a cap equal to its derived baseline is not flagged as overridden', () => {
    render(
      <VitalGauge
        label="SP"
        value={9}
        max={13}
        onChange={() => {}}
        onMaxChange={() => {}}
        overriddenFrom={13}
        onRevertOverride={() => {}}
      />
    )
    expect(screen.queryByText(/overridden from/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /revert sp max/i })).toBeNull()
  })
})

describe('VitalGauge — danger', () => {
  test('lit segments at or past the danger index read status-bad', () => {
    render(<VitalGauge label="Heat" value={9} max={10} danger={7} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Heat 9 of 10' })
    const segments = Array.from(group.querySelectorAll('[data-pip="on"]'))
    expect(segments.length).toBe(9)
    // Segments 8 and 9 (index 7, 8) are past the danger line → red fill.
    const dangerSegs = segments.filter((s) => must(s).className.includes('bg-status-bad'))
    expect(dangerSegs.length).toBe(2)
    // Segments below the danger line keep the accent tone.
    const toneSegs = segments.filter((s) => must(s).className.includes('bg-[var(--tone)]'))
    expect(toneSegs.length).toBe(7)
  })
})
