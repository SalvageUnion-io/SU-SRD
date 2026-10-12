/**
 * PEEK (E16): the page's one host shows a trigger's entity on keyboard focus,
 * hover or a long press; Escape hides it; it never takes focus; the trigger
 * is described by it while it is open; and nothing inside it Peeks again.
 */
import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Entity } from '../Entity'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from '../forms/Mention'
import { PeekHost } from '../Peek'

const refOf = (schema: 'traits' | 'systems', name: string): EntityRef => {
  const entity = SalvageUnionReference.getByNameIn(schema, name)
  if (!entity) throw new Error(`${name} fixture missing`)
  return toEntityModel(entity).ref
}

const hrefFor = (ref: EntityRef) => `/schema/${ref.schemaName}/item/${ref.slug}/`

function Page({ entityRef, label }: { entityRef: EntityRef; label: string }) {
  return (
    <EntitySurfaceProvider value={{ hrefFor }}>
      <p>
        It gains the <Mention entityRef={entityRef}>{label}</Mention> Trait.
      </p>
      <PeekHost />
    </EntitySurfaceProvider>
  )
}

describe('PeekHost', () => {
  test('keyboard focus shows the Peek, describes the trigger, and Escape hides it', async () => {
    render(<Page entityRef={refOf('traits', 'burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => link.focus())
    const peek = await screen.findByRole('tooltip')
    // The card, read-only: the trait's own name heads it.
    await waitFor(() => expect(peek.textContent?.toLowerCase()).toContain('burn'))
    expect(link.getAttribute('aria-describedby')).toBe(peek.id)
    // Not focus-trapping: focus stays on the trigger.
    expect(document.activeElement).toBe(link)
    act(() => {
      fireEvent.keyDown(link, { key: 'Escape' })
    })
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    expect(link.getAttribute('aria-describedby')).toBeNull()
  })

  test('focus a pointer press gave does not open it: the press is a click', async () => {
    render(<Page entityRef={refOf('traits', 'burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      fireEvent.pointerDown(link, { pointerType: 'mouse' })
      link.focus()
    })
    // Give a wrongly-opened Peek the time it would take to appear.
    await expect(screen.findByRole('tooltip', {}, { timeout: 400 })).rejects.toThrow()
  })

  test('hovering with a mouse shows it after a rest', async () => {
    render(<Page entityRef={refOf('traits', 'burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      fireEvent.pointerOver(link, { pointerType: 'mouse' })
    })
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  test('a long press opens it and swallows the click that ends it', async () => {
    render(<Page entityRef={refOf('traits', 'burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      fireEvent.pointerDown(link, { pointerType: 'touch', clientX: 10, clientY: 10 })
    })
    expect(await screen.findByRole('tooltip')).toBeTruthy()
    const navigate = mock((event: MouseEvent) => event.defaultPrevented)
    link.addEventListener('click', navigate)
    act(() => {
      fireEvent.pointerUp(link, { pointerType: 'touch' })
      fireEvent.click(link)
    })
    // The click never reached the link's own handlers: no navigation.
    expect(navigate).not.toHaveBeenCalled()
  })

  test('a Peek never nests: nothing inside it is a trigger', async () => {
    // A system's card carries trait Tags, which Peek everywhere but here.
    const drill = refOf('systems', 'Salvaging Drill')
    render(<Page entityRef={drill} label="Salvaging Drill" />)
    act(() => screen.getByRole('link', { name: 'Salvaging Drill' }).focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent).toContain('Salvaging Drill'))
    expect(peek.querySelector('[data-peek]')).toBeNull()
    expect(peek.querySelector('a, button')).toBeNull()
  })

  test('a Token is a trigger: hovering or focusing it shows its whole card', async () => {
    const drill = SalvageUnionReference.getByNameIn('systems', 'Salvaging Drill')
    if (!drill) throw new Error('Salvaging Drill fixture missing')
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Entity form="token" entity={drill} mode={{ kind: 'link' }} />
        <PeekHost />
      </EntitySurfaceProvider>
    )
    const token = screen.getByRole('link', { name: 'Salvaging Drill' })
    expect(token.getAttribute('data-peek')).toBe(`systems:${drill.id}`)
    act(() => token.focus())
    const peek = await screen.findByRole('tooltip')
    // More than the token says: the card's rules text, not just its name.
    await waitFor(() => expect(peek.textContent?.length ?? 0).toBeGreaterThan(100))
    expect(token.getAttribute('aria-describedby')).toBe(peek.id)
  })
})
