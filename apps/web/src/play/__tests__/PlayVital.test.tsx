import { expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PlayVital } from '../PlayVital'
import { amountOf, vitalAfter } from '../unitStats.model'

test('an amount is a whole number above zero', () => {
  expect(amountOf(' 3 ')).toBe(3)
  expect(amountOf('0')).toBeNull()
  expect(amountOf('-2')).toBeNull()
  expect(amountOf('x')).toBeNull()
  expect(vitalAfter(8, -3, 10)).toBe(5)
  expect(vitalAfter(2, -3, 10)).toBe(0)
  expect(vitalAfter(8, 5, 10)).toBe(10)
})

test('press the number, type an amount, take it: one write', async () => {
  const writes: number[] = []
  render(<PlayVital label="HP" value={8} max={10} tone="pilot" onChange={(n) => writes.push(n)} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Change HP by an amount, now 8 of 10' }))
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'HP amount' }), { target: { value: '3' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Take 3 from HP' }))
  })
  expect(writes).toEqual([5])
  // The gauge is back, the form gone.
  expect(screen.queryByRole('textbox', { name: 'HP amount' })).toBeNull()
})

test('adding stops at the maximum, and a read-out has no number to press', async () => {
  const writes: number[] = []
  const { rerender } = render(
    <PlayVital label="SP" value={4} max={6} tone="adversary" onChange={(n) => writes.push(n)} />
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Change SP by an amount/ }))
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'SP amount' }), { target: { value: '9' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add 9 to SP' }))
  })
  expect(writes).toEqual([6])
  rerender(<PlayVital label="SP" value={4} max={6} tone="adversary" />)
  expect(screen.queryByRole('button', { name: /Change SP by an amount/ })).toBeNull()
})

/** The amount entry's own line: hidden while it has nothing to say. */
const hint = () => document.querySelector('form [role="status"]')?.textContent

test('the amount entry keeps the current value in view, and says why nothing can be taken (r2 C6)', async () => {
  render(<PlayVital label="SP" value={3} max={9} tone="mech" onChange={() => {}} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Change SP by an amount/ }))
  })
  const form = screen.getByRole('form', { name: 'Change SP by an amount' })
  expect(form.textContent).toContain('SP 3/9')
  const amount = screen.getByRole('textbox', { name: 'SP amount' })
  fireEvent.change(amount, { target: { value: '-2' } })
  expect(hint()).toBe('Type a whole number, 1 or more.')
  fireEvent.change(amount, { target: { value: '2' } })
  expect(hint()).toBe('')
})

test('an over-large amount says it will be capped, and tells the write so (r2 C6)', async () => {
  const writes: [number, string | undefined][] = []
  render(
    <PlayVital
      label="SP"
      value={3}
      max={9}
      tone="mech"
      onChange={(next, note) => writes.push([next, note])}
    />
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Change SP by an amount/ }))
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'SP amount' }), { target: { value: '9' } })
  expect(hint()).toBe('Only 3 to take: − 9 stops at 0. Only 6 to add: + 9 stops at 9.')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Take 9 from SP' }))
  })
  expect(writes).toEqual([[0, 'Capped at 0']])
})

// r3 J4: a vital is one Tab stop; ← / → move between its number, slider, − and +.
test('a live vital is one Tab stop, and the arrow keys move between its controls', () => {
  const writes: number[] = []
  render(<PlayVital label="HP" value={8} max={10} tone="pilot" onChange={(n) => writes.push(n)} />)
  const number = screen.getByRole('button', { name: 'Change HP by an amount, now 8 of 10' })
  const slider = screen.getByRole('slider')
  const minus = screen.getByRole('button', { name: 'Decrease HP' })
  const plus = screen.getByRole('button', { name: 'Increase HP' })
  const stops = [number, slider, minus, plus]
  expect(stops.map((el) => el.tabIndex)).toEqual([0, -1, -1, -1])
  number.focus()
  fireEvent.keyDown(number, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(slider)
  // On the slider ← / → are the row's: they move on, and change nothing.
  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(minus)
  expect(writes).toEqual([])
  // The row's one Tab stop is the control last used.
  expect(stops.map((el) => el.tabIndex)).toEqual([-1, -1, 0, -1])
  fireEvent.keyDown(minus, { key: 'ArrowLeft' })
  expect(document.activeElement).toBe(slider)
  // ↑ / ↓ still set the value there.
  fireEvent.keyDown(slider, { key: 'ArrowDown' })
  expect(writes).toEqual([7])
})

test('a step that empties the vital hands the focus on, never to the page (r3 J4)', () => {
  const view = (value: number) => (
    <PlayVital label="HP" value={value} max={10} tone="pilot" onChange={() => {}} />
  )
  const { rerender } = render(view(1))
  const minus = screen.getByRole('button', { name: 'Decrease HP' })
  minus.focus()
  rerender(view(0))
  expect((minus as HTMLButtonElement).disabled).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Increase HP' }))
})

test('the amount form hands the focus back to the number it was opened from (r3 J4)', async () => {
  render(<PlayVital label="HP" value={8} max={10} tone="pilot" onChange={() => {}} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Change HP by an amount/ }))
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'HP amount' }), { target: { value: '3' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'Change HP by an amount' }))
  })
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: /Change HP by an amount/ })
  )
})

test('a read-out vital has no Tab stop to manage', () => {
  render(<PlayVital label="HP" value={8} max={10} tone="pilot" />)
  expect(screen.queryByRole('slider')).toBeNull()
})
