/**
 * PEEK (E16): the page's one host shows a trigger's entity on keyboard focus,
 * hover or a long press; Escape hides it; it never takes focus; the trigger
 * is described by it while it is open; and nothing inside it Peeks again.
 */
import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { EntityRef, RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Entity } from '../Entity'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from '../forms/Mention'
import { PeekHost } from '../Peek'
import { embeddedPeekAddress } from '../peekContext'

const refOf = (schema: 'traits' | 'systems', name: string): EntityRef => {
  const entity = SalvageUnionReference.getByNameIn(schema, name)
  if (!entity) throw new Error(`${name} fixture missing`)
  return toEntityModel(entity).ref
}

const hrefFor = (ref: EntityRef) => `/${ref.schemaName}/${ref.slug}/`

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
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
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

  // r6 G8: the keyboard reads on below the line it Tabs through, so its
  // Peek stands above; a hover's hangs below as ever.
  test("keyboard focus's Peek stands above the line, a hover's below", async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => link.focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.getAttribute('data-side')).toBe('top'))
    act(() => {
      fireEvent.keyDown(link, { key: 'Escape' })
      link.blur()
    })
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    act(() => {
      fireEvent.pointerOver(link, { pointerType: 'mouse' })
    })
    const hovered = await screen.findByRole('tooltip')
    await waitFor(() => expect(hovered.getAttribute('data-side')).toBe('bottom'))
  })

  // r6 G7: a list's row prints the stats; its chassis's Peek leads with the ability.
  test("a chassis Peeked from a list's row leaves the row's stats out", async () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (!mule) throw new Error('fixture missing: Mule')
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <table className="su-ledger__table">
          <tbody>
            <tr>
              <th>
                <Mention entityRef={toEntityModel(mule).ref} goes>
                  Mule
                </Mention>
              </th>
            </tr>
          </tbody>
        </table>
        <PeekHost />
      </EntitySurfaceProvider>
    )
    act(() => screen.getByRole('link', { name: 'Mule' }).focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent).toContain('Integrated Cargo Bay'))
    expect(peek.textContent).not.toContain('MODS')
    // A row is no sentence: its Peek hangs under it, focus's too.
    expect(peek.getAttribute('data-side')).toBe('bottom')
  })

  test('focus a pointer press gave does not open it: the press is a click', async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      fireEvent.pointerDown(link, { pointerType: 'mouse' })
      link.focus()
    })
    // Give a wrongly-opened Peek the time it would take to appear.
    await expect(screen.findByRole('tooltip', {}, { timeout: 400 })).rejects.toThrow()
  })

  test('focus handed back as Escape closes a dialog does not open it (r8 E10)', async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      // A dialog the label opened closes on Escape, and hands focus back to it.
      fireEvent.keyDown(document.body, { key: 'Escape' })
      link.focus()
    })
    await expect(screen.findByRole('tooltip', {}, { timeout: 400 })).rejects.toThrow()
  })

  test('hovering with a mouse shows it after a rest', async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      fireEvent.pointerOver(link, { pointerType: 'mouse' })
    })
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  test('content scrolled under a resting mouse opens nothing until it moves (RR7-06)', async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => {
      // The mouse came to rest somewhere; the page then scrolled the link under it.
      fireEvent.pointerMove(document.body, { pointerType: 'mouse', clientX: 40, clientY: 40 })
      fireEvent.pointerOver(link, { pointerType: 'mouse', clientX: 40, clientY: 40 })
    })
    await expect(screen.findByRole('tooltip', {}, { timeout: 400 })).rejects.toThrow()
    act(() => {
      fireEvent.pointerMove(link, { pointerType: 'mouse', clientX: 41, clientY: 40 })
    })
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  test('a long press opens it and swallows the click that ends it', async () => {
    render(<Page entityRef={refOf('traits', 'Burn')} label="Burn" />)
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

  test('a Peek never nests: nothing inside it is a trigger, and only its name links', async () => {
    // A system's card carries trait Tags, which Peek everywhere but here.
    const drill = refOf('systems', 'Salvaging Drill')
    render(<Page entityRef={drill} label="Salvaging Drill" />)
    act(() => screen.getByRole('link', { name: 'Salvaging Drill' }).focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent).toContain('Salvaging Drill'))
    expect(peek.querySelector('[data-peek]')).toBeNull()
    // Its links are its name and, a term's, Open page (E27): both to its
    // Page, both out of the tab order (E16).
    expect(peek.querySelector('a:not([data-peek-open], [data-peek-out]), button')).toBeNull()
    expect(peek.querySelector('[data-peek-open]')?.getAttribute('tabindex')).toBe('-1')
    expect(peek.querySelector('[data-peek-out]')?.getAttribute('tabindex')).toBe('-1')
  })

  test('a Mini is a trigger: hovering or focusing it shows its whole card', async () => {
    const drill = SalvageUnionReference.getByNameIn('systems', 'Salvaging Drill')
    if (!drill) throw new Error('Salvaging Drill fixture missing')
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Entity size="mini" context="loadout" entity={drill} mode={{ kind: 'link' }} />
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

  test('a trigger whose press does nothing else (`data-peek-press`) opens its Peek on a press', async () => {
    const meld = SalvageUnionReference.getByNameIn('abilities', 'Meld Form')
    if (!meld) throw new Error('Meld Form fixture missing')
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <button type="button" data-peek={`abilities:${meld.id}`} data-peek-press="">
          Meld Form
        </button>
        <PeekHost />
      </EntitySurfaceProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Meld Form' })
    act(() => {
      fireEvent.pointerDown(trigger, { pointerType: 'mouse' })
      fireEvent.click(trigger)
    })
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent).toContain('Meld Form'))
    expect(trigger.getAttribute('aria-describedby')).toBe(peek.id)
  })

  test("an embedded record Peeks through its host: a bay's crew NPC", async () => {
    const bay = SalvageUnionReference.getByNameIn('crawler-bays', 'Cantina')
    if (!bay?.npc) throw new Error('Cantina fixture missing')
    const npc = { ...bay.npc, name: bay.npc.position, schemaName: 'npcs' }
    render(
      <>
        <Entity
          size="mini"
          context="loadout"
          entity={npc as unknown as RefMetaEntity}
          peekAt={embeddedPeekAddress('crawler-bays', bay.id, 'npc')}
        />
        <PeekHost />
      </>
    )
    const token = document.querySelector('.su-entity-mini')
    if (!token) throw new Error('no token')
    expect(token.getAttribute('data-peek')).toBe(`crawler-bays:${bay.id}/npc`)
    act(() => {
      fireEvent.pointerOver(token, { pointerType: 'mouse' })
    })
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent).toContain('Chef'))
  })
})
