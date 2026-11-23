/**
 * The Actions list as one Tab stop (r7 B8): the closed rows' Use buttons are
 * one stop, the arrows move between them, and a closed row's links wait for
 * the row to open. A row with no Use to press keeps its own Tab order.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useActionsRove } from '../useActionsRove'

function Row({ name, open = false, use = true }: { name: string; open?: boolean; use?: boolean }) {
  return (
    <li className="su-play-act" data-open={open || undefined}>
      <a href={`/${name}`}>{name}</a>
      <a href={`/${name}/keyword`}>{`${name} keyword`}</a>
      {use ? (
        <button type="button" className="su-play-act__use">{`Use ${name}`}</button>
      ) : (
        <button type="button">{`Vent ${name}`}</button>
      )}
    </li>
  )
}

function List({ open = false }: { open?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useActionsRove(ref)
  return (
    <div ref={ref}>
      <ul>
        <Row name="cannon" />
        <Row name="kit" open={open} />
        <Row name="reactor" use={false} />
      </ul>
    </div>
  )
}

const tab = (name: string) =>
  (
    screen.getByRole(name.startsWith('Use') || name.startsWith('Vent') ? 'button' : 'link', {
      name,
    }) as HTMLElement
  ).tabIndex

describe('the Actions list, one Tab stop (r7 B8)', () => {
  test('the first Use takes Tab; the other Uses and closed rows’ links do not', () => {
    render(<List />)
    expect(tab('Use cannon')).toBe(0)
    expect(tab('Use kit')).toBe(-1)
    expect(tab('cannon')).toBe(-1)
    expect(tab('cannon keyword')).toBe(-1)
    // No Use to press: its own order.
    expect(tab('Vent reactor')).toBe(0)
    expect(tab('reactor keyword')).toBe(0)
  })

  test('the arrows move between the Uses, and the stop follows the focus', () => {
    render(<List />)
    const cannon = screen.getByRole('button', { name: 'Use cannon' })
    act(() => cannon.focus())
    fireEvent.keyDown(cannon, { key: 'ArrowDown' })
    const kit = screen.getByRole('button', { name: 'Use kit' })
    expect(document.activeElement).toBe(kit)
    expect(kit.tabIndex).toBe(0)
    expect(cannon.tabIndex).toBe(-1)
    fireEvent.keyDown(kit, { key: 'Home' })
    expect(document.activeElement).toBe(cannon)
  })

  test('an open row keeps its own order, its links reached', async () => {
    const { rerender } = render(<List />)
    expect(tab('kit keyword')).toBe(-1)
    await act(async () => {
      rerender(<List open />)
    })
    expect(tab('kit keyword')).toBe(0)
    expect(tab('kit')).toBe(0)
  })
})
