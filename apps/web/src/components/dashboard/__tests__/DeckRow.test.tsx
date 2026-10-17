/**
 * DeckRow — one action in the deck: its pennant acts, a locked row dims and
 * says why as a tooltip (the canvas) or a line under it (the phone).
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { DeckEntry } from '../DeckRow'
import { DeckRow } from '../DeckRow'

const auger = SalvageUnionReference.Actions.getByName('Auger')
if (!auger) throw new Error('no Auger')

const row = (over: Partial<DeckEntry> = {}): DeckEntry => ({
  key: 'auger',
  entity: auger,
  name: 'Auger',
  locked: false,
  ...over,
})

describe('DeckRow', () => {
  test('its pennant is the action, and the row carries its deck key', () => {
    const onClick = mock(() => {})
    const { container } = render(
      <ul>
        <DeckRow row={row()} lock="title" pennant={{ label: 'Resolve', onClick }} />
      </ul>
    )
    expect(container.querySelector('[data-deck-key="auger"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Resolve/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('locked on the canvas: dimmed, still payable, why as a tooltip', () => {
    const { container } = render(
      <ul>
        <DeckRow
          row={row({ locked: true, lockTitle: 'Out of range' })}
          lock="title"
          pennant={{ label: 'Resolve', onClick: () => {} }}
        />
      </ul>
    )
    expect(container.querySelector('li')?.getAttribute('title')).toBe('Out of range')
    expect(container.querySelector('.su-ec-outer--dim')).not.toBeNull()
    expect(screen.queryByText('Out of range')).toBeNull()
  })

  test('locked on the phone: the pennant is off, the body still opens, why is a line', () => {
    const onOpen = mock(() => {})
    render(
      <ul>
        <DeckRow
          row={row({ locked: true, lockTitle: 'Out of range' })}
          lock="note"
          pennant={{ label: 'Activate', onClick: () => {}, disabledWhenLocked: true }}
          onOpen={onOpen}
        />
      </ul>
    )
    expect((screen.getByRole('button', { name: /Activate/ }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(screen.getByText('Out of range')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Auger' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
