/**
 * Step 1 of the Pilot wizard (r7 F5, F6): the book's page is printed once, in
 * the rule box, never on the lists; each first-ability row carries what it
 * does under its name, for a phone, where the column is dropped.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityStep } from '../ClassAbilityStep'

const hauler = SalvageUnionReference.Classes.getByName('Hauler') as { id: string } | undefined

describe('ClassAbilityStep', () => {
  test('no citation on the lists; each ability says what it does under its name', () => {
    const { container } = render(
      <ClassAbilityStep
        classId={hauler?.id ?? ''}
        selectedAbilities={[]}
        onSelectClass={() => {}}
        onSelectAbility={() => {}}
      />
    )
    const lists = [...container.querySelectorAll('.su-ledger')]
    expect(lists).toHaveLength(2)
    for (const list of lists) expect(list.textContent).not.toContain('p.18')
    const row = screen.getByRole('radio', { name: /^Folk Song/ }).closest('tr') as HTMLElement
    const under = row.querySelector('th .su-wiz-phone-under')
    expect(under?.textContent).toMatch(/song/i)
  })
})

/** r8 F3 (SB8-01, SB8-17): a class is chosen seeing its first abilities. */
describe('ClassAbilityStep — the class list previews', () => {
  test('each class row names its first abilities before it is picked', () => {
    render(
      <ClassAbilityStep
        classId=""
        selectedAbilities={[]}
        onSelectClass={() => {}}
        onSelectAbility={() => {}}
      />
    )
    const row = screen.getByRole('radio', { name: /^Hauler/ }).closest('tr') as HTMLElement
    expect(row.textContent).toContain('Folk Song')
    const salvager = screen.getByRole('radio', { name: /^Salvager/ }).closest('tr') as HTMLElement
    expect(salvager.textContent).toContain('Level 1 of any Core Tree')
  })
})

describe('ClassAbilityStep — a pick on a phone', () => {
  function Picking() {
    const [classId, setClassId] = useState('')
    return (
      <ClassAbilityStep
        classId={classId}
        selectedAbilities={[]}
        onSelectClass={setClassId}
        onSelectAbility={() => {}}
      />
    )
  }

  test('picking a class brings its first abilities into view when they open below the fold', () => {
    const proto = HTMLElement.prototype
    // Put back as found: an inherited method restored as an own one would
    // shadow a later file's spy on `Element.prototype`.
    const had = {
      rect: Object.getOwnPropertyDescriptor(proto, 'getBoundingClientRect'),
      scroll: Object.getOwnPropertyDescriptor(proto, 'scrollIntoView'),
    }
    const media = window.matchMedia
    const scrolled: string[] = []
    // A phone: no lg.
    window.matchMedia = ((query: string) => ({
      ...media.call(window, query),
      matches: false,
    })) as typeof window.matchMedia
    proto.getBoundingClientRect = () => ({ top: window.innerHeight + 200, height: 400 }) as DOMRect
    proto.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.id)
    }
    try {
      render(<Picking />)
      expect(scrolled).toEqual([])
      fireEvent.click(screen.getByRole('radio', { name: /^Hauler/ }))
      expect(scrolled).toEqual(['wiz-first-ability'])
    } finally {
      for (const [key, found] of [
        ['getBoundingClientRect', had.rect],
        ['scrollIntoView', had.scroll],
      ] as const) {
        if (found) Object.defineProperty(proto, key, found)
        else delete (proto as Partial<HTMLElement>)[key]
      }
      window.matchMedia = media
    }
  })
})
