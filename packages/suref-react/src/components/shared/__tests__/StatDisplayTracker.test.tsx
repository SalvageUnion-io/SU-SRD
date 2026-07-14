import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StatDisplay } from '../StatDisplay'

afterEach(cleanup)

/** Narrow a possibly-null query result, failing the test loudly if absent. */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected element to be present')
  return value
}

// The framed-tracker anatomy (formerly StatBlock): the dots prop.
describe('StatDisplay (tracker) — numeric mode', () => {
  test('renders code, value/max and the unit bar', () => {
    render(<StatDisplay dots label="HP" unit="Points" value={7} max={10} />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('/10')).toBeTruthy()
    expect(screen.getByText('Points')).toBeTruthy()
  })

  test('controlled value with onChange steps and clamps 0..max', () => {
    const onChange = mock((v: number) => v)
    render(<StatDisplay dots label="AP" value={5} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Increase AP'))
    expect(onChange).toHaveBeenLastCalledWith(5) // clamped at max
    fireEvent.click(screen.getByLabelText('Decrease AP'))
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  test('clamps below zero', () => {
    const onChange = mock((v: number) => v)
    render(<StatDisplay dots label="AP" value={0} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Decrease AP'))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  test('uncontrolled (init) self-manages its value', () => {
    render(<StatDisplay dots label="TP" init={2} />)
    expect(screen.getByText('2')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Increase TP'))
    expect(screen.getByText('3')).toBeTruthy()
  })

  test('unbounded counter (no max) renders no pips and never clamps up', () => {
    const { container } = render(<StatDisplay dots label="TP" init={11} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
    fireEvent.click(screen.getByLabelText('Increase TP'))
    expect(screen.getByText('12')).toBeTruthy()
  })

  test('bare value without onChange is read-only (no steppers): mech Cargo case', () => {
    render(<StatDisplay dots label="CARGO" value={4} max={6} tone="cargo" />)
    expect(screen.queryByLabelText('Increase CARGO')).toBeNull()
    expect(screen.queryByLabelText('Decrease CARGO')).toBeNull()
  })

  test('sm size hides steppers even when editable', () => {
    render(<StatDisplay dots label="HP" size="sm" value={3} max={4} onChange={() => {}} />)
    expect(screen.queryByLabelText('Increase HP')).toBeNull()
  })

  test('pips follow the bottom-heavy ≤6/row split and fill to value', () => {
    const { container } = render(<StatDisplay dots label="SP" value={8} max={13} />)
    const pips = container.querySelectorAll('[data-pip]')
    expect(pips.length).toBe(13)
    expect(container.querySelectorAll('[data-pip="on"]').length).toBe(8)
    // 13 → 4/4/5 rows
    const rows = must(container.querySelectorAll('[data-pip]')[0]?.parentElement?.parentElement)
    const rowCounts = Array.from(rows.children).map((row) => row.children.length)
    expect(rowCounts).toEqual([4, 4, 5])
  })

  test('pips=false suppresses the track (e.g. SYS 5/20)', () => {
    const { container } = render(<StatDisplay dots label="SYS" value={5} max={20} pips={false} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
  })

  test('pip click-to-set: lit pip truncates, unlit pip fills up to it', () => {
    const onChange = mock((v: number) => v)
    const { container } = render(
      <StatDisplay dots label="HP" value={5} max={10} onChange={onChange} />
    )
    const pips = container.querySelectorAll('[data-pip]')
    fireEvent.click(must(pips[2])) // lit (index 2 < 5) → 2
    expect(onChange).toHaveBeenLastCalledWith(2)
    fireEvent.click(must(pips[8])) // unlit → 9
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  test('read-only pips are not buttons', () => {
    const { container } = render(<StatDisplay dots label="CARGO" value={2} max={6} />)
    const pip = must(container.querySelector('[data-pip]'))
    expect(pip.tagName).not.toBe('BUTTON')
  })
})

describe('StatDisplay (tracker) — heat escalation (U-1)', () => {
  test('below ~70% heat renders plain warn pips and no escalation', () => {
    const { container } = render(<StatDisplay dots label="HEAT" value={6} max={10} tone="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBeNull()
    expect(must(root.lastElementChild).className).toContain('border-ink')
    expect(container.querySelector('[data-pip].bg-status-bad')).toBeNull()
  })

  test('at >= ~70% heat the lit pips past the line go status-bad', () => {
    const { container } = render(<StatDisplay dots label="HEAT" value={8} max={10} tone="heat" />)
    expect(screen.getByRole('group').getAttribute('data-heat')).toBe('high')
    const pips = Array.from(container.querySelectorAll('[data-pip]'))
    const danger = pips.filter((p) => p.className.includes('bg-status-bad'))
    // pips 7 and 8 (indices 6,7) are lit and past the 70% line
    expect(danger.length).toBe(2)
    expect(pips.indexOf(must(danger[0]))).toBe(6)
    // pips below the line keep the warn fill
    expect(pips[0]?.className).toContain('bg-status-warn')
  })

  test('at cap the block gets the red border + pulse', () => {
    render(<StatDisplay dots label="HEAT" value={10} max={10} tone="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBe('critical')
    expect(must(root.lastElementChild).className).toContain('border-status-bad')
    expect(must(root.lastElementChild).className).toContain('motion-safe:animate-heat-pulse')
    expect(must(root.lastElementChild).className).not.toContain('border-ink')
  })

  test('inert without a max (suref-web static render)', () => {
    render(<StatDisplay dots label="HEAT" init={9} tone="heat" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBeNull()
    expect(must(root.lastElementChild).className).toContain('border-ink')
  })

  test('non-heat tones never escalate, even at cap', () => {
    render(<StatDisplay dots label="HP" value={10} max={10} tone="hp" />)
    const root = screen.getByRole('group')
    expect(root.getAttribute('data-heat')).toBeNull()
    expect(must(root.lastElementChild).className).toContain('border-ink')
    expect(must(root.lastElementChild).className).not.toContain('animate-heat-pulse')
  })
})

describe('StatDisplay (tracker) — states[] tally mode (crawler bays)', () => {
  const states = [
    'intact',
    'intact',
    'intact',
    'intact',
    'intact',
    'intact',
    'intact',
    'intact',
    'damaged',
    'damaged',
  ] as const

  test('renders one pip per bay with state titles', () => {
    render(<StatDisplay dots label="BAYS" states={[...states]} />)
    expect(screen.getByTitle('Bay 1 · intact')).toBeTruthy()
    expect(screen.getByTitle('Bay 9 · damaged')).toBeTruthy()
    expect(screen.getByTitle('Bay 10 · damaged')).toBeTruthy()
  })

  test('tallies counts per present state', () => {
    render(<StatDisplay dots label="BAYS" states={[...states]} />)
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('intact')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('damaged')).toBeTruthy()
    // no destroyed tally — crawler bays are two-state
    expect(screen.queryByText('destroyed')).toBeNull()
  })

  test('onBay makes pips clickable with the bay index', () => {
    const onBay = mock((i: number) => i)
    render(<StatDisplay dots label="BAYS" states={[...states]} onBay={onBay} />)
    fireEvent.click(screen.getByTitle('Bay 9 · damaged'))
    expect(onBay).toHaveBeenLastCalledWith(8)
  })

  test('states mode renders no steppers or numeric value row', () => {
    render(<StatDisplay dots label="BAYS" states={[...states]} />)
    expect(screen.queryByLabelText('Increase BAYS')).toBeNull()
  })
})
