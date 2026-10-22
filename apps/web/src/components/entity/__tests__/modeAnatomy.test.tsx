/**
 * A mode fills slots; it never changes a form's anatomy (EDL E7) or what a
 * slot holds (chips-and-actions C9). A Compact and a Mini draw the same parts,
 * in the same order, and the same chips, whether they read, link or sit in a
 * picker selected or not; select's ring and seal ride the frame it already has.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../Entity'
import type { EntityMode } from '../types'

const drill = () => {
  const found = SalvageUnionReference.Systems.getByName('Salvaging Drill')
  if (!found) throw new Error('fixture missing: Salvaging Drill')
  return found
}

const MODES: Record<string, EntityMode> = {
  read: { kind: 'read' },
  link: { kind: 'link', href: '/systems/salvaging-drill/' },
  'select, chosen': { kind: 'select', role: 'radio', selected: true, onSelect: () => {} },
  'select, not chosen': { kind: 'select', role: 'toggle', selected: false, onSelect: () => {} },
}

/** The form's parts in document order, and its chips' text. */
function anatomy(size: 'compact' | 'mini', mode: EntityMode) {
  const { container, unmount } = render(
    <Entity size={size} context="loadout" entity={drill()} mode={mode} />
  )
  const parts = [...container.querySelectorAll('[class*="su-entity-"]')].map((el) =>
    [...el.classList].filter((c) => c.startsWith('su-entity-')).join('.')
  )
  const chips = [...container.querySelectorAll('[data-chip-class]')].map((lane) =>
    (lane.textContent ?? '').replace(/\s+/g, ' ').trim()
  )
  unmount()
  return { parts, chips }
}

describe('a mode never changes a form', () => {
  for (const size of ['compact', 'mini'] as const) {
    test(`a ${size === 'compact' ? 'Compact' : 'Mini'} keeps its parts and chips in every mode`, () => {
      const read = anatomy(size, { kind: 'read' })
      expect(read.parts.length).toBeGreaterThan(3)
      expect(read.chips.length).toBeGreaterThan(0)
      for (const [name, mode] of Object.entries(MODES)) {
        expect({ mode: name, ...anatomy(size, mode) }).toEqual({ mode: name, ...read })
      }
    })
  }
})
