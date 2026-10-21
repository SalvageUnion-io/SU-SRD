/**
 * A RELATION TAG (C11): a fact whose value is an entity (`CLASS | Engineer`)
 * is the label-first Stat chip, and opens and Peeks the entity it names;
 * inside a Peek it only reads (E16).
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Tag } from '../parts/Tags'
import { relation } from '../parts/tagItems'
import { InsidePeekContext } from '../peekContext'

const engineer = (): EntityRef => {
  const found = SalvageUnionReference.Classes.getByName('Engineer')
  if (!found) throw new Error('Engineer fixture missing')
  return toEntityModel(found).ref
}

/** The relation `CLASS | Engineer`, opening `href` when given. */
const classTag = (ref: EntityRef, href?: string) => (
  <Tag tag={relation('class', 'Class', ref.name, { ref, href })} linkable wrap />
)

describe('a relation Tag', () => {
  test('is the label-first chip, its value the entity’s name', () => {
    const { container } = render(classTag(engineer(), '/x/'))
    expect(container.querySelector('.su-stat-plate--label')?.textContent).toBe('Class')
    expect(container.querySelector('.su-stat-plate--value')?.textContent).toBe('Engineer')
  })

  test('links to the given route and Peeks the entity', () => {
    const ref = engineer()
    render(classTag(ref, '/classes/engineer/'))
    const link = screen.getByRole('link', { name: 'Class: Engineer' })
    expect(link.getAttribute('href')).toBe('/classes/engineer/')
    expect(link.getAttribute('data-peek')).toBe(`classes:${ref.id}`)
  })

  test('without a route it opens the surface’s Page', () => {
    const openPage = mock((_: EntityRef) => undefined)
    render(
      <EntitySurfaceProvider value={{ openPage }}>{classTag(engineer())}</EntitySurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Class: Engineer' }))
    expect(openPage).toHaveBeenCalledTimes(1)
  })

  test('inside a Peek it neither links nor Peeks', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        {classTag(engineer(), '/classes/engineer/')}
      </InsidePeekContext.Provider>
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('[data-peek]')).toBeNull()
    expect(screen.getByText('Engineer')).toBeTruthy()
  })
})
