/**
 * Unit tests for CrawlerCrewStep — the wizard's crew/NPC roster step
 * (a Ledger line a crewed Bay, the open line's fields under it).
 *
 * Renders the 10 crewed base bays (the 4 expansion bays carry no NPC →
 * excluded) plus the selected crawler type's special NPC HEADING the list.
 * Each row is a line (the Bay, its lead, their HP) until opened; the open
 * row exposes the freeform set Name/Background/Keepsake/Motto through
 * live text fields, guarded off the NPC's own choices: the
 * Augmented type's A.I. has only Name/Background.
 *
 * Uses real SalvageUnionReference data. NO mock.module().
 */

import { describe, expect, it, mock } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../../components/__tests__/must'
import type { CrewNpcForm } from '../../../lib/wizard/crawlerFormState'
import { CrawlerCrewStep } from '../CrawlerCrewStep'

function crewedBays() {
  return SalvageUnionReference.CrawlerBays.all().filter((b) => b.npc != null)
}

function bayByName(name: string) {
  return must(crewedBays().find((b) => b.name === name))
}

/** Open a roster row's fields: the row's radio, named for its Bay or type. */
function expandRow(name: string): void {
  fireEvent.click(screen.getByRole('radio', { name }))
}

/** A live text field, by its name. */
function field(name: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}$`, 'i') })
}

describe('CrawlerCrewStep', () => {
  it('renders exactly the 10 crewed base bays as roster rows (expansion bays excluded)', () => {
    const bays = crewedBays()
    expect(bays.length).toBe(10)
    const { container } = render(
      <CrawlerCrewStep bays={bays} selectedType={undefined} crew={{}} onChange={() => {}} />
    )
    for (const bay of bays) {
      expect(container.textContent).toContain((bay as { name: string }).name)
    }
    // No expansion bay (e.g. VR Tubes) has a crew row.
    expect(container.textContent).not.toContain('VR Tubes')
  })

  it('an expanded standard bay exposes Name/Background/Keepsake/Motto fields', () => {
    render(
      <CrawlerCrewStep
        bays={[bayByName('Command Bay')]}
        selectedType={undefined}
        crew={{}}
        onChange={() => {}}
      />
    )
    // Collapsed: no fields yet.
    expect(screen.queryByRole('textbox', { name: /keepsake/i })).toBeNull()

    expandRow('Command Bay')
    expect(screen.getByRole('textbox', { name: /name$/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /background/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /keepsake/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /motto/i })).toBeTruthy()
  })

  it('the selected type’s special NPC HEADS the roster with its full field set', () => {
    const battle = must(SalvageUnionReference.Crawlers.getByName('Battle'))
    const { container } = render(
      <CrawlerCrewStep bays={crewedBays()} selectedType={battle} crew={{}} onChange={() => {}} />
    )
    const text = container.textContent ?? ''
    // The type row renders before the first bay row.
    expect(text.indexOf('Battle')).toBeLessThan(text.indexOf('Command Bay'))

    expandRow('Battle')
    expect(screen.getByRole('textbox', { name: /grizzled veteran keepsake/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /grizzled veteran motto/i })).toBeTruthy()
  })

  it('Augmented edge: A.I. NPC shows Name/Background only (no Keepsake/Motto)', () => {
    const augmented = must(SalvageUnionReference.Crawlers.getByName('Augmented'))
    render(<CrawlerCrewStep bays={[]} selectedType={augmented} crew={{}} onChange={() => {}} />)
    expandRow('Augmented')
    expect(screen.getByRole('textbox', { name: /union crawler a\.i\. name/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /union crawler a\.i\. background/i })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /keepsake/i })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /motto/i })).toBeNull()
  })

  it('edits a bay NPC field through onChange (merging crew state)', () => {
    const onChange = mock((patch: { crew?: Record<string, CrewNpcForm> }) => patch)
    const command = bayByName('Command Bay')
    render(
      <CrawlerCrewStep bays={[command]} selectedType={undefined} crew={{}} onChange={onChange} />
    )
    expandRow('Command Bay')
    fireEvent.change(field('princeps name'), { target: { value: 'Maddox' } })
    expect(onChange).toHaveBeenCalledWith({
      crew: { [getEntitySlug(command)]: { name: 'Maddox' } },
    })
  })

  it('renders existing crew values in the expanded row', () => {
    const command = bayByName('Command Bay')
    const crew: Record<string, CrewNpcForm> = {
      [getEntitySlug(command)]: { name: 'Maddox', motto: 'Hold the line' },
    }
    render(
      <CrawlerCrewStep bays={[command]} selectedType={undefined} crew={crew} onChange={() => {}} />
    )
    expandRow('Command Bay')
    expect(field('princeps name').value).toBe('Maddox')
    expect(field('princeps motto').value).toBe('Hold the line')
  })
})
