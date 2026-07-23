/**
 * Unit tests for CrawlerCrewStep — the wizard's crew/NPC roster step
 * (wizard-refresh Phase 5: entity-card rows expanding to IdentityFields).
 *
 * Renders the 10 crewed base bays (the 4 expansion bays carry no NPC →
 * excluded) plus the selected crawler type's special NPC HEADING the list.
 * Each row is the SRD entity card, header-only until expanded; the expanded
 * row exposes the freeform set Name/Background/Keepsake/Motto through
 * click-to-edit IdentityFields, guarded off the NPC's own choices: the
 * Augmented type's A.I. has only Name/Background.
 *
 * Uses real SalvageUnionReference data. NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { CrawlerCrewStep } from '../CrawlerCrewStep'
import type { CrewNpcForm } from '../../../lib/wizard/crawlerFormState'
import { must } from '../../__tests__/must'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

function crewedBays() {
  return SalvageUnionReference.CrawlerBays.all().filter((b) => b.npc != null)
}

function bayByName(name: string) {
  return must(crewedBays().find((b) => b.name === name))
}

/** Expand a roster row by clicking its entity card (cardClick → role=button). */
function expandRow(name: string): void {
  const card = screen
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').includes(name) && b.getAttribute('aria-label') === null)
  if (!card) throw new Error(`No clickable roster card for "${name}"`)
  fireEvent.click(card)
}

/** Open a click-to-edit IdentityField and return its input. */
function openField(editLabel: string): HTMLInputElement {
  fireEvent.click(screen.getByRole('button', { name: editLabel }))
  return screen.getByRole<HTMLInputElement>('textbox', { name: editLabel })
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

  it('an expanded standard bay exposes Name/Background/Keepsake/Motto IdentityFields', () => {
    render(
      <CrawlerCrewStep
        bays={[bayByName('Command Bay')]}
        selectedType={undefined}
        crew={{}}
        onChange={() => {}}
      />
    )
    // Collapsed: no fields yet.
    expect(screen.queryByRole('button', { name: /keepsake/i })).toBeNull()

    expandRow('Command Bay')
    expect(screen.getByRole('button', { name: /name$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /background/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /keepsake/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /motto/i })).toBeTruthy()
  })

  it('the selected type’s special NPC HEADS the roster with its full field set', () => {
    const battle = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle'))
    const { container } = render(
      <CrawlerCrewStep bays={crewedBays()} selectedType={battle} crew={{}} onChange={() => {}} />
    )
    const text = container.textContent ?? ''
    // The type row renders before the first bay row.
    expect(text.indexOf('Battle')).toBeLessThan(text.indexOf('Command Bay'))

    expandRow('Battle')
    expect(screen.getByRole('button', { name: /grizzled veteran keepsake/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /grizzled veteran motto/i })).toBeTruthy()
  })

  it('Augmented edge: A.I. NPC shows Name/Background only (no Keepsake/Motto)', () => {
    const augmented = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Augmented'))
    render(<CrawlerCrewStep bays={[]} selectedType={augmented} crew={{}} onChange={() => {}} />)
    expandRow('Augmented')
    expect(screen.getByRole('button', { name: /union crawler a\.i\. name/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /union crawler a\.i\. background/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /keepsake/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /motto/i })).toBeNull()
  })

  it('edits a bay NPC field through onChange (merging crew state)', () => {
    const onChange = mock((patch: { crew?: Record<string, CrewNpcForm> }) => patch)
    const command = bayByName('Command Bay')
    render(
      <CrawlerCrewStep bays={[command]} selectedType={undefined} crew={{}} onChange={onChange} />
    )
    expandRow('Command Bay')
    const input = openField('Edit princeps name')
    fireEvent.change(input, { target: { value: 'Maddox' } })
    fireEvent.blur(input, { target: { value: 'Maddox' } })
    expect(onChange).toHaveBeenCalledWith({
      crew: { [command.id]: { name: 'Maddox' } },
    })
  })

  it('renders existing crew values in the expanded row', () => {
    const command = bayByName('Command Bay')
    const crew: Record<string, CrewNpcForm> = {
      [command.id]: { name: 'Maddox', motto: 'Hold the line' },
    }
    render(
      <CrawlerCrewStep bays={[command]} selectedType={undefined} crew={crew} onChange={() => {}} />
    )
    expandRow('Command Bay')
    expect(screen.getByRole('button', { name: 'Edit princeps name' }).textContent).toContain(
      'Maddox'
    )
    expect(screen.getByRole('button', { name: 'Edit princeps motto' }).textContent).toContain(
      'Hold the line'
    )
  })
})
