import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BayStatus } from '../BayStatus'

afterEach(cleanup)

// The crawler-bay condition tally — its own primitive (the former StatDisplay
// states[] mode). Ported from the retired framed-tracker states tests.
describe('BayStatus — crawler-bay condition tally', () => {
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

  test('renders one swatch per bay with state titles', () => {
    render(<BayStatus states={[...states]} />)
    expect(screen.getByTitle('Bay 1 · intact')).toBeTruthy()
    expect(screen.getByTitle('Bay 9 · damaged')).toBeTruthy()
    expect(screen.getByTitle('Bay 10 · damaged')).toBeTruthy()
  })

  test('tallies counts per present state (destroyed absent)', () => {
    render(<BayStatus states={[...states]} />)
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('intact')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('damaged')).toBeTruthy()
    expect(screen.queryByText('destroyed')).toBeNull()
  })

  test('onBayClick makes each bay a button carrying its index', () => {
    const onBayClick = mock((i: number) => i)
    render(<BayStatus states={[...states]} onBayClick={onBayClick} />)
    fireEvent.click(screen.getByTitle('Bay 9 · damaged'))
    expect(onBayClick).toHaveBeenLastCalledWith(8)
  })

  test('read-only bays are static (no buttons)', () => {
    render(<BayStatus states={[...states]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
