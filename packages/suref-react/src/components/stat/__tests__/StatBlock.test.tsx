import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StatBlock } from '../StatBlock'

afterEach(cleanup)

describe('StatBlock — numeric mode', () => {
  test('renders code, value/max and the unit bar', () => {
    render(<StatBlock code="HP" unit="Points" value={7} max={10} />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('/10')).toBeTruthy()
    expect(screen.getByText('Points')).toBeTruthy()
  })

  test('controlled value with onChange steps and clamps 0..max', () => {
    const onChange = mock((v: number) => v)
    render(<StatBlock code="AP" value={5} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Increase AP'))
    expect(onChange).toHaveBeenLastCalledWith(5) // clamped at max
    fireEvent.click(screen.getByLabelText('Decrease AP'))
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  test('clamps below zero', () => {
    const onChange = mock((v: number) => v)
    render(<StatBlock code="AP" value={0} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Decrease AP'))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  test('uncontrolled (init) self-manages its value', () => {
    render(<StatBlock code="TP" init={2} />)
    expect(screen.getByText('2')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Increase TP'))
    expect(screen.getByText('3')).toBeTruthy()
  })

  test('unbounded counter (no max) renders no pips and never clamps up', () => {
    const { container } = render(<StatBlock code="TP" init={11} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
    fireEvent.click(screen.getByLabelText('Increase TP'))
    expect(screen.getByText('12')).toBeTruthy()
  })

  test('bare value without onChange is read-only (no steppers): mech Cargo case', () => {
    render(<StatBlock code="CARGO" value={4} max={6} stat="cargo" />)
    expect(screen.queryByLabelText('Increase CARGO')).toBeNull()
    expect(screen.queryByLabelText('Decrease CARGO')).toBeNull()
  })

  test('sm size hides steppers even when editable', () => {
    render(<StatBlock code="HP" size="sm" value={3} max={4} onChange={() => {}} />)
    expect(screen.queryByLabelText('Increase HP')).toBeNull()
  })

  test('pips follow the bottom-heavy ≤6/row split and fill to value', () => {
    const { container } = render(<StatBlock code="SP" value={8} max={13} />)
    const pips = container.querySelectorAll('[data-pip]')
    expect(pips.length).toBe(13)
    expect(container.querySelectorAll('[data-pip="on"]').length).toBe(8)
    // 13 → 4/4/5 rows
    const rows = container.querySelectorAll('[data-pip]')[0]!.parentElement!.parentElement!
    const rowCounts = Array.from(rows.children).map((row) => row.children.length)
    expect(rowCounts).toEqual([4, 4, 5])
  })

  test('pips=false suppresses the track (e.g. SYS 5/20)', () => {
    const { container } = render(<StatBlock code="SYS" value={5} max={20} pips={false} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(0)
  })

  test('pip click-to-set: lit pip truncates, unlit pip fills up to it', () => {
    const onChange = mock((v: number) => v)
    const { container } = render(<StatBlock code="HP" value={5} max={10} onChange={onChange} />)
    const pips = container.querySelectorAll('[data-pip]')
    fireEvent.click(pips[2]!) // lit (index 2 < 5) → 2
    expect(onChange).toHaveBeenLastCalledWith(2)
    fireEvent.click(pips[8]!) // unlit → 9
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  test('read-only pips are not buttons', () => {
    const { container } = render(<StatBlock code="CARGO" value={2} max={6} />)
    const pip = container.querySelector('[data-pip]')!
    expect(pip.tagName).not.toBe('BUTTON')
  })
})

describe('StatBlock — states[] tally mode (crawler bays)', () => {
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
    render(<StatBlock code="BAYS" states={[...states]} />)
    expect(screen.getByTitle('Bay 1 · intact')).toBeTruthy()
    expect(screen.getByTitle('Bay 9 · damaged')).toBeTruthy()
    expect(screen.getByTitle('Bay 10 · damaged')).toBeTruthy()
  })

  test('tallies counts per present state', () => {
    render(<StatBlock code="BAYS" states={[...states]} />)
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('intact')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('damaged')).toBeTruthy()
    // no destroyed tally — crawler bays are two-state
    expect(screen.queryByText('destroyed')).toBeNull()
  })

  test('onBay makes pips clickable with the bay index', () => {
    const onBay = mock((i: number) => i)
    render(<StatBlock code="BAYS" states={[...states]} onBay={onBay} />)
    fireEvent.click(screen.getByTitle('Bay 9 · damaged'))
    expect(onBay).toHaveBeenLastCalledWith(8)
  })

  test('states mode renders no steppers or numeric value row', () => {
    render(<StatBlock code="BAYS" states={[...states]} />)
    expect(screen.queryByLabelText('Increase BAYS')).toBeNull()
  })
})
