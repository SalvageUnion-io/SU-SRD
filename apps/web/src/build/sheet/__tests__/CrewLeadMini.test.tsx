/**
 * CrewLeadMini — a crawler bay's crew lead as a CONTENTFUL Mini (N3):
 * - the head names the NPC, chips the role it holds (`ROLE | Doc`) once it
 *   has a name of its own, and reads its HP live (`HP | 3/4`);
 * - in Edit the head keeps HP, as its stepper (the uses slot), never in the body;
 * - the body holds what the sheet tracks (Keepsake, Motto, Detail, Facts),
 *   each left out in Read when empty;
 * - the group is named for its bay, so several crew leads stay distinguishable;
 * - in Edit it starts collapsed, its lines read as in Read, its Details
 *   control in the head opening their fields.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { unitRowModel } from '../../../lib/units/unitModel'
import { CrewLeadMini } from '../CrewLeadMini'

const crew = (name: string) => unitRowModel({ kind: 'npc', name, userMade: true })

const BASE = {
  bayName: 'Med Bay',
  title: 'Doc',
  hp: 3,
  maxHp: 4,
  keepsake: '',
  motto: '',
  detail: '',
  facts: [] as string[],
}

function head(group: HTMLElement): HTMLElement {
  const found = group.querySelector<HTMLElement>('.su-entity-mini__head')
  if (!found) throw new Error('no Mini head')
  return found
}

describe('CrewLeadMini — the head', () => {
  test('a named crew lead: its role a chip beside its HP, read live', () => {
    render(<CrewLeadMini {...BASE} name="Ambrose" model={crew('Ambrose')} />)
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const band = head(group)
    // The role rides the head's chips, not a stamp before the name.
    expect(band.querySelector('.su-entity-mini__kind')).toBeNull()
    expect(band.querySelector('.su-entity-mini__name')?.textContent).toContain('Ambrose')
    expect(within(band).getByText('Role')).toBeTruthy()
    expect(within(band).getByText('Doc')).toBeTruthy()
    // First, next to the name: before the HP reading.
    const text = band.textContent ?? ''
    expect(text.indexOf('Role')).toBeLessThan(text.indexOf('HP'))
    expect(band.textContent).toContain('HP')
    expect(band.textContent).toContain('3/4')
    // A contentful Mini, never a titled box (N5).
    expect(group.querySelector('.su-entity-mini[data-contentful]')).toBeTruthy()
    expect(group.querySelector('.su-box')).toBeNull()
  })

  test('a crew lead with no name of its own chips no role: its title is the role', () => {
    render(<CrewLeadMini {...BASE} name="Doc" model={crew('Doc')} />)
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(within(band).queryByText('Role')).toBeNull()
  })

  test('in Edit the head holds the HP stepper, and the body none', () => {
    render(<CrewLeadMini {...BASE} name="Ambrose" model={crew('Ambrose')} onHpChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const band = head(group)
    expect(band.textContent).toContain('3/4')
    expect(within(band).getByRole('button', { name: 'Decrease Med Bay crew HP' })).toBeTruthy()
    const body = group.querySelector<HTMLElement>('.su-entity-mini__body')
    expect(body?.textContent ?? '').not.toContain('HP')
  })

  test('a crew lead with no HP to track has no HP chip', () => {
    render(<CrewLeadMini {...BASE} maxHp={0} hp={0} name="Ambrose" model={crew('Ambrose')} />)
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(within(band).queryByText('HP')).toBeNull()
  })

  test("a bay's SRD crew NPC keeps its book HP label, read at the sheet's value", () => {
    const bay = SalvageUnionReference.CrawlerBays.getByName('Med Bay')
    const npc = bay?.npc
    if (!npc) throw new Error('fixture missing: the Med Bay crew NPC')
    render(
      <CrewLeadMini
        {...BASE}
        title={npc.position}
        name=""
        hp={2}
        maxHp={npc.hitPoints}
        entity={{ ...npc, name: npc.position, schemaName: 'npcs' } as unknown as RefMetaEntity}
      />
    )
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(band.textContent).toContain(`2/${npc.hitPoints}`)
    // One HP reading, not the book's beside the sheet's.
    expect(band.textContent?.match(/HP/g)).toHaveLength(1)
  })
})

describe('CrewLeadMini — the body', () => {
  test('Read lists only the lines that hold something', () => {
    render(
      <CrewLeadMini
        {...BASE}
        name="Ambrose"
        model={crew('Ambrose')}
        keepsake="A locket"
        facts={['Hates rain']}
      />
    )
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const body = group.querySelector<HTMLElement>('.su-entity-mini__body')
    if (!body) throw new Error('no Mini body')
    expect(within(body).getByText('Keepsake')).toBeTruthy()
    expect(within(body).getByText('A locket')).toBeTruthy()
    expect(within(body).getByText('Hates rain')).toBeTruthy()
    expect(within(body).queryByText('Motto')).toBeNull()
    // Compacts, as Detail reads, never `[label | value]` chips.
    expect(body.querySelector('.su-stat-cell')).toBeNull()
  })
})

describe('CrewLeadMini — collapsed in Edit', () => {
  const editing = {
    ...BASE,
    keepsake: 'A bent cog',
    onNameChange: () => {},
    onHpChange: () => {},
    onKeepsakeChange: () => {},
  }

  test('its lines read as in Read until Details opens their fields', () => {
    render(<CrewLeadMini {...editing} name="Ambrose" model={crew('Ambrose')} />)
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    expect(within(group).getByText('A bent cog')).toBeTruthy()
    expect(within(group).queryByLabelText('Edit med bay crew keepsake')).toBeNull()
    const details = within(head(group)).getByRole('button', { name: 'Edit Med Bay crew details' })
    fireEvent.click(details)
    expect(within(group).getByLabelText('Edit med bay crew keepsake')).toBeTruthy()
    expect(within(group).getByLabelText('Edit med bay crew name')).toBeTruthy()
    fireEvent.click(within(head(group)).getByRole('button', { name: 'Close Med Bay crew details' }))
    expect(within(group).queryByLabelText('Edit med bay crew keepsake')).toBeNull()
  })

  test('Read has no Details control', () => {
    render(<CrewLeadMini {...BASE} name="Ambrose" model={crew('Ambrose')} />)
    expect(screen.queryByRole('button', { name: /crew details$/ })).toBeNull()
  })
})
