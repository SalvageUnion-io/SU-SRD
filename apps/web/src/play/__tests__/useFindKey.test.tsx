/** "/" jumps to Play's action search, from anywhere but a field being typed in (r3 J4). */

import { expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useFindKey } from '../useFindKey'

function Screen({ hidden = false }: { hidden?: boolean }) {
  const tools = useRef<HTMLDivElement>(null)
  useFindKey(tools)
  return (
    <>
      <button type="button">Decrease HP</button>
      <input aria-label="HP amount" />
      <section hidden={hidden}>
        <div ref={tools}>
          <input aria-label="Find an action" defaultValue="hov" />
        </div>
      </section>
    </>
  )
}

test('the slash key focuses Find and selects what is there', () => {
  render(<Screen />)
  const minus = screen.getByRole('button', { name: 'Decrease HP' })
  minus.focus()
  const pressed = fireEvent.keyDown(minus, { key: '/' })
  const find = screen.getByRole('textbox', { name: 'Find an action' }) as HTMLInputElement
  expect(document.activeElement).toBe(find)
  // The key is the shortcut's: no "/" is typed into the field it lands in.
  expect(pressed).toBe(false)
  expect([find.selectionStart, find.selectionEnd]).toEqual([0, 3])
})

test('a slash typed into a field stays a slash, and a chord is not the shortcut', () => {
  render(<Screen />)
  const amount = screen.getByRole('textbox', { name: 'HP amount' })
  amount.focus()
  expect(fireEvent.keyDown(amount, { key: '/' })).toBe(true)
  expect(document.activeElement).toBe(amount)
  const minus = screen.getByRole('button', { name: 'Decrease HP' })
  minus.focus()
  expect(fireEvent.keyDown(minus, { key: '/', ctrlKey: true })).toBe(true)
  expect(document.activeElement).toBe(minus)
})

test('a Find in a hidden pane takes no focus', () => {
  render(<Screen hidden />)
  const minus = screen.getByRole('button', { name: 'Decrease HP' })
  minus.focus()
  expect(fireEvent.keyDown(minus, { key: '/' })).toBe(true)
  expect(document.activeElement).toBe(minus)
})
