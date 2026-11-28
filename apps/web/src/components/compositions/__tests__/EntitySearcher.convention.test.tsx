/**
 * The one picker convention (PT-06, PT-07, PT-16, SB-22): the search field is
 * focused when the picker opens, Enter adds the first match and the picker
 * stays open counting it, a list entry has no hover card (its Page opens
 * beside it), and a picker given a Tech Level opens on it, tags what sits
 * above it and widens with "Show all Tech Levels".
 */

import { describe, expect, it, mock, spyOn } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { POOL_RENDER_MS } from './entitySearcherHarness'

const slug = (item: { name: string }) => nameToSlug(item.name)

describe('EntitySearcher — the picker convention', () => {
  it(
    'opens with the search field focused',
    () => {
      // The picker focuses on the next frame; the frame is run here, so the
      // test waits on no timer another file may hold.
      const frame = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((run) => {
        run(0)
        return 0
      })
      try {
        render(<EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} />)
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }))
      } finally {
        frame.mockRestore()
      }
    },
    POOL_RENDER_MS
  )

  it(
    'Enter adds the first match and keeps the picker open on it',
    () => {
      const onAdd = mock((_: string) => undefined)
      render(
        <EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} onAdd={onAdd} />
      )
      const search = screen.getByRole('textbox', { name: 'Search' })
      // Nothing typed: Enter adds nothing.
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).not.toHaveBeenCalled()
      fireEvent.change(search, { target: { value: 'chainsaw' } })
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).toHaveBeenCalledTimes(1)
      const added = onAdd.mock.calls[0]?.[0] ?? ''
      expect(added).toContain('chainsaw')
      // Its Page is open beside the list, and the search text is kept.
      expect(screen.getByRole('group', { name: /chainsaw.* actions/i })).toBeTruthy()
      expect((search as HTMLInputElement).value).toBe('chainsaw')
    },
    POOL_RENDER_MS
  )

  it(
    'Show all Tech Levels hands the cursor back to Search, so Enter still adds (r3 J3)',
    () => {
      const onAdd = mock((_: string) => undefined)
      render(
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={[]}
          idOf={slug}
          techLevel={1}
          onAdd={onAdd}
        />
      )
      const search = screen.getByRole('textbox', { name: 'Search' })
      const all = screen.getByRole('button', { name: 'Show all Tech Levels' })
      all.focus()
      fireEvent.click(all)
      expect(screen.queryByRole('button', { name: 'Show all Tech Levels' })).toBeNull()
      expect(document.activeElement).toBe(search)
    },
    POOL_RENDER_MS
  )

  it(
    'Enter never removes a toggle pick already made',
    () => {
      const onToggle = mock((_: string) => undefined)
      const first = SalvageUnionReference.Equipment.getByName('Hacking Kit')
      if (!first) throw new Error('Hacking Kit missing')
      render(
        <EntitySearcher
          schema="equipment"
          selected={[slug(first)]}
          idOf={slug}
          onToggle={onToggle}
        />
      )
      const search = screen.getByRole('textbox', { name: 'Search' })
      fireEvent.change(search, { target: { value: 'Hacking Kit' } })
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onToggle).not.toHaveBeenCalled()
    },
    POOL_RENDER_MS
  )

  it(
    'a list entry carries no hover card: its Page opens beside it',
    () => {
      const { container } = render(
        <EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} />
      )
      const list = container.querySelector('.su-searcher__list')
      expect(list?.querySelectorAll('[data-searcher-open]').length).toBeGreaterThan(0)
      expect(list?.querySelector('[data-peek]')).toBeNull()
    },
    POOL_RENDER_MS
  )

  it(
    'opens on the given Tech Level, and Show all Tech Levels tags what is above it',
    () => {
      const all = SalvageUnionReference.Systems.all()
      const atOne = all.filter((s) => s.techLevel === 1).length
      render(
        <EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} techLevel={1} />
      )
      expect(screen.getByText(`Showing ${atOne} of ${all.length}`)).toBeTruthy()
      expect(screen.queryByText('Above Tech 1')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Show all Tech Levels' }))
      expect(screen.getByText(`Showing ${all.length} of ${all.length}`)).toBeTruthy()
      expect(screen.getAllByText('Above Tech 1').length).toBe(all.length - atOne)
      expect(screen.queryByRole('button', { name: 'Show all Tech Levels' })).toBeNull()
      // A Tech 1 line is untagged.
      const tech1 = all.find((s) => s.techLevel === 1)
      const line = screen
        .getAllByRole('button', { name: tech1?.name ?? '' })[0]
        ?.closest<HTMLElement>('.su-searcher__item')
      expect(line && within(line).queryByText('Above Tech 1')).toBeNull()
    },
    POOL_RENDER_MS
  )
})
