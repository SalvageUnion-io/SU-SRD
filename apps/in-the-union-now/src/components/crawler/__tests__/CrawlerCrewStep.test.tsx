/**
 * Unit tests for CrawlerCrewStep — the wizard's crew/NPC details step.
 *
 * Renders the 10 crewed base bays (the 4 expansion bays carry no NPC →
 * excluded) plus the selected crawler type's special NPC. Each NPC exposes the
 * SRD freeform set Name/Description/Keepsake/Motto, guarded off the NPC's own
 * choices: the Augmented type's A.I. has only Name/Description.
 *
 * Uses real SalvageUnionReference data. NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler } from 'salvageunion-reference'

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
  return (
    SalvageUnionReference.CrawlerBays.all() as Array<{ id: string; name: string; npc?: unknown }>
  ).filter((b) => b.npc != null) as Array<{
    id: string
    name: string
    npc?: { position?: string; choices?: ReadonlyArray<{ id: string; name: string }> }
  }>
}

function byId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`#${id}`)
  if (!el) throw new Error(`No element #${id}`)
  return el as HTMLElement
}

describe('CrawlerCrewStep', () => {
  it('renders exactly the 10 crewed base bays (expansion bays excluded)', () => {
    const bays = crewedBays()
    expect(bays.length).toBe(10)
    const { container } = render(
      <CrawlerCrewStep bays={bays} selectedType={undefined} crew={{}} onChange={() => {}} />
    )
    for (const bay of bays) {
      expect(byId(container, `crew-${bay.id}-name`)).toBeTruthy()
    }
    // No expansion bay (e.g. VR Tubes) has a crew section.
    expect(container.textContent).not.toContain('VR Tubes')
  })

  it('renders Name/Description/Keepsake/Motto for a standard bay NPC', () => {
    const bays = crewedBays()
    const command = must(bays.find((b) => b.name === 'Command Bay'))
    const { container } = render(
      <CrawlerCrewStep bays={bays} selectedType={undefined} crew={{}} onChange={() => {}} />
    )
    expect(byId(container, `crew-${command.id}-name`)).toBeTruthy()
    expect(byId(container, `crew-${command.id}-description`)).toBeTruthy()
    expect(byId(container, `crew-${command.id}-keepsake`)).toBeTruthy()
    expect(byId(container, `crew-${command.id}-motto`)).toBeTruthy()
  })

  it('includes the selected type’s special NPC with its full field set', () => {
    const battle = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle'))
    const { container } = render(
      <CrawlerCrewStep bays={crewedBays()} selectedType={battle} crew={{}} onChange={() => {}} />
    )
    expect(byId(container, `crew-${battle.id}-name`)).toBeTruthy()
    expect(byId(container, `crew-${battle.id}-keepsake`)).toBeTruthy()
    expect(byId(container, `crew-${battle.id}-motto`)).toBeTruthy()
  })

  it('Augmented edge: A.I. NPC shows Name/Description only (no Keepsake/Motto)', () => {
    const augmented = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Augmented'))
    const { container } = render(
      <CrawlerCrewStep bays={crewedBays()} selectedType={augmented} crew={{}} onChange={() => {}} />
    )
    expect(byId(container, `crew-${augmented.id}-name`)).toBeTruthy()
    expect(byId(container, `crew-${augmented.id}-description`)).toBeTruthy()
    expect(container.querySelector(`#crew-${augmented.id}-keepsake`)).toBeNull()
    expect(container.querySelector(`#crew-${augmented.id}-motto`)).toBeNull()
  })

  it('edits a bay NPC field through onChange (merging crew state)', () => {
    const bays = crewedBays()
    const command = must(bays.find((b) => b.name === 'Command Bay'))
    const onChange = mock((patch: { crew?: Record<string, CrewNpcForm> }) => patch)
    const { container } = render(
      <CrawlerCrewStep bays={bays} selectedType={undefined} crew={{}} onChange={onChange} />
    )
    fireEvent.change(byId(container, `crew-${command.id}-name`), {
      target: { value: 'Maddox' },
    })
    expect(onChange).toHaveBeenCalledWith({
      crew: { [command.id]: { name: 'Maddox' } },
    })
  })

  it('renders existing crew values', () => {
    const bays = crewedBays()
    const command = must(bays.find((b) => b.name === 'Command Bay'))
    const crew: Record<string, CrewNpcForm> = {
      [command.id]: { name: 'Maddox', motto: 'Hold the line' },
    }
    const { container } = render(
      <CrawlerCrewStep
        bays={bays}
        selectedType={undefined as unknown as SURefCrawler | undefined}
        crew={crew}
        onChange={() => {}}
      />
    )
    expect((byId(container, `crew-${command.id}-name`) as HTMLInputElement).value).toBe('Maddox')
    expect((byId(container, `crew-${command.id}-motto`) as HTMLInputElement).value).toBe(
      'Hold the line'
    )
  })
})
