/**
 * ClassPathPicker — the live sheet's Change Class body.
 *
 * Pins the ring-shaped list (reachable hybrids first, then Core, then the
 * off-ring hybrids demoted but pickable) and the consequences beside it: the
 * implied origin when the current class is one, the origin question when it
 * is not, and that picking a different destination forgets a previous answer.
 *
 * Real class data; the picker's state is held by a small harness the way the
 * sheet holds it.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassPathPicker } from '../ClassPathPicker'

const ALL = SalvageUnionReference.Classes.all()

function idOf(name: string): string {
  const cls = ALL.find((c) => c.name === name)
  if (!cls) throw new Error(`no class ${name}`)
  return cls.id
}

type Log = { selected: string[]; origins: (string | undefined)[] }

function Harness({ current, log }: { current: string; log: Log }) {
  const [pending, setPending] = useState(current)
  const [origin, setOrigin] = useState<string | undefined>(undefined)
  return (
    <ClassPathPicker
      allClasses={ALL}
      currentClassRef={current}
      pendingClassRef={pending}
      onSelect={(id) => {
        log.selected.push(id)
        setPending(id)
      }}
      answeredOrigin={origin}
      onAnswerOrigin={(id) => {
        log.origins.push(id)
        setOrigin(id)
      }}
    />
  )
}

function renderPicker(currentName: string) {
  const log: Log = { selected: [], origins: [] }
  render(<Harness current={idOf(currentName)} log={log} />)
  return log
}

/** A class card, by the accessible label its radio carries. */
const card = (name: string | RegExp) => screen.getByRole('radio', { name })

async function pick(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(card(name))
  })
}

describe('ClassPathPicker — the ring', () => {
  test('a Core pilot sees their reachable hybrids first, then Core, then the rest', () => {
    renderPicker('Hacker')
    const text = document.body.textContent ?? ''
    const from = text.indexOf('From Hacker')
    const rehome = text.indexOf('Re-home to a Core Class')
    const offRing = text.indexOf("Not on this pilot's ring")
    expect(from).toBeGreaterThanOrEqual(0)
    expect(rehome).toBeGreaterThan(from)
    expect(offRing).toBeGreaterThan(rehome)

    // The current class is marked as such, and selected.
    expect(card('Hacker, current').getAttribute('aria-checked')).toBe('true')
    // A reachable hybrid says how it is reached.
    expect(card(/^Cyborg, via /)).toBeTruthy()
  })

  test('a pilot with no ring sees the plain Core and Advanced / Hybrid groups', () => {
    renderPicker('Salvager')
    expect(screen.getByText('Core Classes')).toBeTruthy()
    expect(screen.getByText('Advanced / Hybrid')).toBeTruthy()
    expect(screen.queryByText(/^From /)).toBeNull()
  })
})

describe('ClassPathPicker — consequences', () => {
  test('a reachable hybrid records the current class as its origin, unasked', async () => {
    const log = renderPicker('Hacker')
    await pick(/^Cyborg, via /)

    expect(log.selected).toEqual([idOf('Cyborg')])
    expect(screen.getByText('Hacker → Cyborg')).toBeTruthy()
    expect(document.body.textContent).toContain('Recorded as Hacker')
    expect(screen.getByText('Gain')).toBeTruthy()
    expect(screen.getByText('Lose')).toBeTruthy()
    // Other hybrids from Hacker close forever.
    expect(screen.getByText(/— forever/)).toBeTruthy()
    expect(screen.queryByText('Where did they come from?')).toBeNull()
  })

  test('an off-ring hybrid asks where the pilot came from, and the answer is kept', async () => {
    const log = renderPicker('Hacker')
    const offRing = screen
      .getAllByRole('radio')
      .find((el) => el.getAttribute('aria-label')?.endsWith(', asks origin'))
    if (!offRing) throw new Error('no off-ring class offered')
    const offRingName = offRing.getAttribute('aria-label')?.replace(', asks origin', '') ?? ''

    await act(async () => {
      fireEvent.click(offRing)
    })
    expect(screen.getByText('Where did they come from?')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Recorded as')

    const origins = screen.getAllByRole('radio', { name: /^Came from / })
    expect(origins.length).toBeGreaterThan(0)
    const first = origins[0]
    if (!first) throw new Error('no origin offered')
    const originName = first.getAttribute('aria-label')?.replace('Came from ', '') ?? ''
    await act(async () => {
      fireEvent.click(first)
    })
    expect(log.origins.at(-1)).toBe(idOf(originName))
    expect(
      screen.getByRole('radio', { name: `Came from ${originName}` }).getAttribute('aria-checked')
    ).toBe('true')

    // Changing destination invalidates the answer.
    await pick('Soldier')
    expect(log.origins.at(-1)).toBeUndefined()
    expect(log.selected).toEqual([idOf(offRingName), idOf('Soldier')])
  })

  test('re-homing to a Core class keeps every ability and asks nothing', async () => {
    renderPicker('Hacker')
    await pick('Soldier')
    expect(screen.getByText('Every ability already learned')).toBeTruthy()
    expect(screen.queryByText('Lose')).toBeNull()
    expect(screen.queryByText('Where did they come from?')).toBeNull()
  })
})
