/**
 * Hard rule R15, one select mode (EDL Modes): a selected Card (level 1) wears
 * the ink ring AND the "Selected" seal, with no caller having to ask for the
 * seal; a chosen Mini (level 2, `<Entity size="mini" chosen>`) wears the ring alone; an
 * option the picker cannot take wears the one select dim.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../../../entity/Entity'
import { SELECT_DIM } from '../../../entity/modes/selectedRing'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const RING = '0 0 0 3px var(--color-ink)'

const hauler = () => {
  const found = SalvageUnionReference.Classes.getByName('Hauler')
  if (!found) throw new Error('fixture missing: Hauler')
  return found
}

describe('a selected Card (level 1)', () => {
  test('wears the ring and the "Selected" seal by default', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={hauler()}
        size="compact"
        selected
        selectionRole="radio"
        onCardClick={() => {}}
        cardClickLabel="Hauler"
      />
    )
    // On the head band's right, as a selected Compact's: never riding the frame (§7.2).
    const seal = screen.getByText('Selected')
    expect(seal.closest('.su-entity-compact__head')).not.toBeNull()
    expect(container.querySelector<HTMLElement>('.su-ec-frame')?.style.boxShadow).toBe(RING)
    expect(screen.getByRole('radio', { name: 'Hauler' }).getAttribute('aria-checked')).toBe('true')
  })

  test('unselected, it has neither ring nor seal', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={hauler()}
        selected={false}
        selectionRole="radio"
        onCardClick={() => {}}
      />
    )
    expect(screen.queryByText('Selected')).toBeNull()
    expect(container.querySelector<HTMLElement>('.su-ec-frame')?.style.boxShadow).toBe('')
  })
})

describe('a chosen Mini (level 2)', () => {
  test('wears the ring on its pill and no seal', () => {
    const { container } = render(<Entity size="mini" context="browse" entity={hauler()} chosen />)
    expect(container.querySelector<HTMLElement>('.su-entity-mini__pill')?.style.boxShadow).toBe(
      RING
    )
    expect(screen.queryByText('Selected')).toBeNull()
  })
})

describe('the one select dim', () => {
  test('an option the picker cannot take wears SELECT_DIM, and no other dim', () => {
    const { container } = render(
      <ReferenceEntityCard data={hauler()} selectable={false} onCardClick={() => {}} />
    )
    const outer = container.querySelector('.su-ec-outer')
    expect(outer?.classList.contains(SELECT_DIM)).toBe(true)
    expect((outer as HTMLElement | null)?.style.opacity).toBe('')
  })
})
