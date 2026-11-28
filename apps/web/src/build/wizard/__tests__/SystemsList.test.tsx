/** The Armament Bay picker: pressing a line mounts it (r6 F4). */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { SystemsList } from '../SystemsList'

const [first, second] = SalvageUnionReference.Systems.all().slice(0, 2)
if (!first || !second) throw new Error('no systems')

function press(name: string) {
  const label = screen.getAllByText(name).find((node) => node.closest('label'))
  fireEvent.click(label?.closest('label') as HTMLElement)
}

describe('SystemsList', () => {
  test('a bay of one: a press mounts the line, in place of the mount (r6 F4)', () => {
    const changes: string[][] = []
    const view = (selected: string[]) => (
      <SystemsList
        systems={[first, second]}
        selectedSystemSlugs={selected}
        maxSelectable={1}
        installedWeaponCount={selected.length}
        onChange={(slugs) => changes.push(slugs)}
        cite={undefined}
      />
    )
    const { rerender } = render(view([]))
    press(first.name)
    expect(changes).toEqual([[getEntitySlug(first)]])
    rerender(view([getEntitySlug(first)]))
    press(second.name)
    expect(changes.at(-1)).toEqual([getEntitySlug(second)])
  })

  test('a bay of two adds while mounts remain', () => {
    const changes: string[][] = []
    render(
      <SystemsList
        systems={[first, second]}
        selectedSystemSlugs={[getEntitySlug(first)]}
        maxSelectable={2}
        installedWeaponCount={1}
        onChange={(slugs) => changes.push(slugs)}
        cite={undefined}
      />
    )
    press(second.name)
    expect(changes).toEqual([[getEntitySlug(first), getEntitySlug(second)]])
  })
})
