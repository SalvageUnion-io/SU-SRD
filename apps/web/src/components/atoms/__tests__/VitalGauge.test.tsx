import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
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

/** The editable track's segment at 0-based `index` — pointer-only, so no role. */
function pip(slider: HTMLElement, index: number): HTMLElement {
  return must(slider.querySelector<HTMLElement>(`[data-pip-index="${index}"]`))
}

describe('VitalGauge — render', () => {
  test('renders label, numeral and max, and no Current / Max caption even editable', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.queryByText('Current')).toBeNull()
  })

  test('editable gauge is a role=group with a summary label', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'HP 7 of 10' })).toBeTruthy()
  })

  test('renders one segment per max with correct on/off data-pip hooks', () => {
    render(<VitalGauge label="HP" value={7} max={10} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'HP 7 of 10' })
    expect(group.querySelectorAll('[data-pip]').length).toBe(10)
    expect(group.querySelectorAll<HTMLElement>('[data-pip="on"]').length).toBe(7)
    expect(group.querySelectorAll('[data-pip="off"]').length).toBe(3)
  })
})

describe('VitalGauge — click to set', () => {
  test('clicking the top-lit segment steps the value down (pipClickValue)', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={7} max={10} onChange={onChange} />)
    // Clicking segment 7 (index 6, currently the top-lit pip) sets HP to 6.
    fireEvent.click(pip(screen.getByRole('slider', { name: 'HP' }), 6))
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  test('clicking an unlit segment fills up to it', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={4} max={10} onChange={onChange} />)
    fireEvent.click(pip(screen.getByRole('slider', { name: 'HP' }), 8))
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  test('clamps at the maximum', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="AP" value={4} max={5} onChange={onChange} />)
    // Clicking the last unlit segment fills to max 5.
    fireEvent.click(pip(screen.getByRole('slider', { name: 'AP' }), 4))
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  test('a click between segments sets nothing', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={4} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByRole('slider', { name: 'HP' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

// One tab stop per gauge, not one per pip: the editable track is a slider and
// its segments are pointer-only (a slider's children are presentational).
describe('VitalGauge — slider', () => {
  test.each(['full', 'compact'] as const)(
    'a %s editable gauge is ONE focusable slider carrying the value',
    (size) => {
      render(<VitalGauge label="Cargo" value={5} max={16} onChange={() => {}} size={size} />)
      const slider = screen.getByRole('slider', { name: 'Cargo' })
      expect(slider.tabIndex).toBe(0)
      expect(slider.getAttribute('aria-valuemin')).toBe('0')
      expect(slider.getAttribute('aria-valuemax')).toBe('16')
      expect(slider.getAttribute('aria-valuenow')).toBe('5')
      expect(slider.getAttribute('aria-valuetext')).toBe('Cargo 5 of 16')
      // No pip is a control or a tab stop.
      expect(slider.querySelectorAll('[data-pip]').length).toBe(16)
      expect(slider.querySelectorAll('button, [tabindex]').length).toBe(0)
      cleanup()
    }
  )

  test('the value text names the redline once a lit segment passes it', () => {
    const { rerender } = render(
      <VitalGauge label="Heat" value={4} max={6} danger={4} onChange={() => {}} />
    )
    const slider = screen.getByRole('slider', { name: 'Heat' })
    expect(slider.getAttribute('aria-valuetext')).toBe('Heat 4 of 6')
    rerender(<VitalGauge label="Heat" value={5} max={6} danger={4} onChange={() => {}} />)
    expect(slider.getAttribute('aria-valuetext')).toBe('Heat 5 of 6, over redline')
  })

  test('a read-only gauge has no slider', () => {
    render(<VitalGauge label="HP" value={7} max={10} readOnly />)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  test('arrow keys on the max override do not move the value', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="SP" value={9} max={13} onChange={onChange} onMaxChange={() => {}} />)
    fireEvent.keyDown(screen.getByRole('button', { name: /override sp max/i }), {
      key: 'ArrowUp',
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('VitalGauge — keyboard', () => {
  test('ArrowUp / ArrowRight increment, ArrowDown / ArrowLeft decrement', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={5} max={10} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'HP' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(6)
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(10)
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  test('keyboard clamps at the bounds', () => {
    const onChange = mock((v: number) => v)
    render(<VitalGauge label="HP" value={0} max={10} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'HP' }), { key: 'ArrowDown' })
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

  // axe `nested-interactive`: an image may not contain a control, so the
  // provenance trigger of a read-only gauge sits outside the role=img element.
  const LINES = [{ kind: 'base' as const, label: 'Pilot', amount: 10 }]

  test('a read-only gauge keeps its provenance trigger outside the image', () => {
    render(<VitalGauge label="HP" value={7} max={10} readOnly provenance={LINES} />)
    const img = screen.getByRole('img', { name: 'HP 7 of 10' })
    const trigger = screen.getByRole('button', { name: /max hp: how this is derived/i })
    expect(img.contains(trigger)).toBe(false)
    expect(img.querySelectorAll('[data-pip]').length).toBe(10)
  })

  // Play's vitals are numbers only (ADR-029 §3): the compact rung draws no trigger.
  test('a compact gauge draws no provenance trigger', () => {
    render(<VitalGauge label="HP" value={7} max={10} readOnly size="compact" provenance={LINES} />)
    expect(screen.getByRole('img', { name: 'HP 7 of 10' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
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
        breakdown={{ overridden: true, derived: 13 }}
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
        breakdown={{ overridden: true, derived: 13 }}
        onRevertOverride={onRevertOverride}
      />
    )
    expect(screen.getByText(/overridden from 13/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /revert sp max to derived 13/i }))
    expect(onRevertOverride).toHaveBeenCalledTimes(1)
  })

  test('the override marks follow the breakdown flag, never a comparison of numbers', () => {
    // A breakdown that says "not overridden" shows no mark at all, whatever
    // the numbers. The gauge never decides this itself, or it disagrees with
    // the ledger on a pin equal to its derivation (ADR-022 amendment).
    render(
      <VitalGauge
        label="SP"
        value={9}
        max={13}
        onChange={() => {}}
        onMaxChange={() => {}}
        breakdown={{ overridden: false, derived: 13 }}
        onRevertOverride={() => {}}
      />
    )
    expect(screen.queryByText(/overridden from/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /revert sp max/i })).toBeNull()
    const maxButton = screen.getByRole('button', { name: /override sp max/i })
    expect(maxButton.style.color).not.toBe('var(--tone-deep)')
    cleanup()

    render(
      <VitalGauge
        label="SP"
        value={9}
        max={16}
        onChange={() => {}}
        onMaxChange={() => {}}
        breakdown={{ overridden: true, derived: 13 }}
        onRevertOverride={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /override sp max/i }).style.color).toBe(
      'var(--tone-deep)'
    )
    expect(screen.getByText('*')).toBeTruthy()
  })

  test('re-committing the shown max still reports it — the caller normalises', () => {
    // A pin upgrades caught up with reads as the derived value. Typing that
    // value back in is how a player deletes it, so the gauge must not swallow
    // an unchanged commit.
    const onMaxChange = mock(() => {})
    render(
      <VitalGauge label="HP" value={9} max={14} onChange={() => {}} onMaxChange={onMaxChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /override hp max/i }))
    fireEvent.keyDown(mustInput(screen.getByLabelText('Set HP max')), { key: 'Enter' })
    expect(onMaxChange).toHaveBeenCalledWith(14)
  })
})

describe('VitalGauge — danger', () => {
  test('lit segments at or past the danger index read status-bad', () => {
    render(<VitalGauge label="Heat" value={9} max={10} danger={7} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Heat 9 of 10' })
    const segments = Array.from(group.querySelectorAll<HTMLElement>('[data-pip="on"]'))
    expect(segments.length).toBe(9)
    // Segments 8 and 9 (index 7, 8) are past the danger line → red fill.
    const dangerSegs = segments.filter((s) => must(s).style.backgroundColor === color.statusBad)
    expect(dangerSegs.length).toBe(2)
    // Segments below the danger line keep the accent tone.
    const toneSegs = segments.filter((s) => must(s).style.backgroundColor === 'var(--tone)')
    expect(toneSegs.length).toBe(7)
  })

  test('unlit segments past the danger index carry the status-bad outline', () => {
    render(<VitalGauge label="Heat" value={0} max={8} danger={5} readOnly />)
    const track = screen.getByRole('img', { name: 'Heat 0 of 8' })
    const unlit = Array.from(track.querySelectorAll<HTMLElement>('[data-pip="off"]'))
    expect(unlit.length).toBe(8)
    const redline = unlit.filter((s) => must(s).style.borderColor === color.statusBad)
    expect(redline.length).toBe(3)
    expect(redline.every((s) => must(s).style.backgroundColor !== color.statusBad)).toBe(true)
  })
})

// The compact (Play) gauge takes the §4.5 row split like every other pip
// surface: at most six a row, balanced, bottom-heavy — never a fixed five.
describe('VitalGauge — compact pip rows', () => {
  test.each([
    [6, [6]],
    [12, [6, 6]],
    [16, [5, 5, 6]],
  ])('max %i splits into rows %p', (max, rows) => {
    const { container } = render(
      <VitalGauge size="compact" label="SP" value={1} max={max} readOnly />
    )
    const pips = Array.from(container.querySelectorAll('[data-pip]'))
    const perRow = Array.from(new Set(pips.map((p) => p.parentElement))).map(
      (row) => row?.children.length
    )
    expect(perRow).toEqual(rows)
    cleanup()
  })
})

describe('VitalGauge steppers (the compact rung)', () => {
  test('a live compact gauge draws the one − / + pair, clamped at its ends', () => {
    const onChange = mock((_: number) => {})
    render(
      <VitalGauge size="compact" label="HP" value={10} max={10} onChange={onChange} steppers />
    )
    const plus = screen.getByRole<HTMLButtonElement>('button', { name: 'Increase HP' })
    expect(plus.disabled).toBe(true)
    expect(plus.classList.contains('su-step-btn')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease HP' }))
    expect(onChange).toHaveBeenCalledWith(9)
    cleanup()
  })

  test('a read-out has none', () => {
    render(<VitalGauge size="compact" label="HP" value={4} max={10} readOnly steppers />)
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
  })
})

describe('VitalGauge steppers (the full rung, table mode)', () => {
  test('a live full gauge draws the pair under its track, at the Full Size', () => {
    const onChange = mock((_: number) => {})
    render(<VitalGauge label="Heat" value={0} max={9} onChange={onChange} steppers />)
    const minus = screen.getByRole<HTMLButtonElement>('button', { name: 'Decrease Heat' })
    expect(minus.disabled).toBe(true)
    expect(minus.style.height).toBe('var(--size-full)')
    fireEvent.click(screen.getByRole('button', { name: 'Increase Heat' }))
    expect(onChange).toHaveBeenCalledWith(1)
    cleanup()
  })

  test('the sheet passes none: its track is the control', () => {
    render(<VitalGauge label="HP" value={4} max={10} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /Increase HP/ })).toBeNull()
    cleanup()
  })
})

describe('VitalGauge — mini HP cells', () => {
  test('read-only: label, value/max and one square cell per point in a square block', () => {
    render(<VitalGauge size="mini" label="HP" value={3} max={9} readOnly />)
    const gauge = screen.getByRole('img', { name: 'HP 3 of 9' })
    expect(gauge.getAttribute('data-size')).toBe('mini')
    expect(gauge.textContent).toContain('3/9')
    const cells = gauge.querySelectorAll<HTMLElement>('[data-pip]')
    expect(cells).toHaveLength(9)
    expect(gauge.querySelectorAll('[data-pip="on"]')).toHaveLength(3)
    expect(cells[0]?.style.width).toBe(cells[0]?.style.height)
    const grid = must(cells[0]?.parentElement)
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 8px)')
    // The value sits under the cells, a rung smaller.
    const value = must(grid.nextElementSibling as HTMLElement | null)
    expect(value.textContent).toBe('3/9')
    expect(value.style.fontSize).toBe('11px')
  })

  test('editable: the cells are one slider, a click sets the value', () => {
    const onChange = mock((_: number) => {})
    render(<VitalGauge size="mini" label="HP" value={1} max={4} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'HP' })
    fireEvent.click(pip(slider, 2))
    expect(onChange).toHaveBeenCalledWith(3)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(2)
  })
})
