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
