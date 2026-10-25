/**
 * A downed Opposition's wreck (Core Book pp.246, 248): what `wreckOf` says it
 * leaves, and the Salvage control on its box, which rolls Mech Salvage, offers
 * only what the band allows, and settles the haul into the crawler once.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { rollForTable } from '../../../components/index'
import { newTrayNpc, readTrayNpc } from '../opposition.model'
import { PlayWreckSalvage } from '../PlayWreckSalvage'
import type { PlayMediator } from '../usePlayMediator'
import type { Wreck } from '../wreck.model'
import { wreckOf } from '../wreck.model'

const NOW = '2026-10-24T00:00:00.000Z'

function downedHauler() {
  const mule = SalvageUnionReference.Chassis.getByName('Mule')
  const hauler = mule?.patterns?.find((p) => p.name === 'Hauler')
  if (mule === undefined || hauler === undefined) throw new Error('no Mule Hauler')
  const body = { ...newTrayNpc('chassis', mule, [], NOW, { pattern: hauler }), currentHp: 0 }
  return readTrayNpc({ _id: 'n1', body })
}

const dice =
  (die: number): typeof rollForTable =>
  async () =>
  () =>
    die

describe('wreckOf', () => {
  test('a downed Mech leaves its Chassis and the parts its pattern mounts', () => {
    const wreck = wreckOf(downedHauler())
    if (wreck?.kind !== 'mech') throw new Error('expected a mech wreck')
    expect(wreck.parts[0]).toMatchObject({ kind: 'chassis', name: 'Mule', techLevel: 1 })
    expect(wreck.parts.length).toBeGreaterThan(1)
    expect(wreck.parts.slice(1).every((p) => p.kind !== 'chassis')).toBe(true)
  })

  test('a Vehicle is scrapped for its Salvage Value; a squad leaves nothing', () => {
    const vehicle = SalvageUnionReference.Vehicles.all()[0]
    const squad = SalvageUnionReference.Squads.all()[0]
    if (vehicle === undefined || squad === undefined) throw new Error('no reference')
    expect(
      wreckOf(readTrayNpc({ _id: 'v', body: newTrayNpc('vehicles', vehicle, [], NOW) }))
    ).toEqual({
      kind: 'scrap',
      techLevel: vehicle.techLevel as number,
      salvageValue: vehicle.salvageValue as number,
    })
    expect(
      wreckOf(readTrayNpc({ _id: 's', body: newTrayNpc('squads', squad, [], NOW) }))
    ).toBeNull()
  })

  test('a Vehicle off the scrap tiers, or worth nothing, and an NPC with no record leave nothing', () => {
    const vehicle = SalvageUnionReference.Vehicles.all()[0]
    if (vehicle === undefined) throw new Error('no reference')
    const npc = readTrayNpc({ _id: 'v', body: newTrayNpc('vehicles', vehicle, [], NOW) })
    const withEntity = (over: Record<string, unknown>) => ({
      ...npc,
      entity: { ...npc.entity, ...over } as typeof npc.entity,
    })
    expect(wreckOf(withEntity({ techLevel: 7 }))).toBeNull()
    expect(wreckOf(withEntity({ salvageValue: 0 }))).toBeNull()
    expect(wreckOf({ ...npc, entity: null })).toBeNull()
  })
})

describe('the Salvage control', () => {
  function renderSalvage(die: number, settled: Parameters<PlayMediator['salvageWreck']>[1][]) {
    const npc = downedHauler()
    const wreck = wreckOf(npc) as Wreck
    render(
      <PlayWreckSalvage
        npc={npc}
        wreck={wreck}
        canWrite
        hasCrawler
        onSettle={async (_npc, haul) => {
          settled.push(haul)
        }}
        rollFor={dice(die)}
      />
    )
  }

  const crawler = { scrapPool: {}, cargoLots: [] } as unknown as Crawler

  test('an 11–19 offers the Chassis or one part, and takes the pick to the hold', async () => {
    const settled: Parameters<PlayMediator['salvageWreck']>[1][] = []
    renderSalvage(15, settled)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Mech Salvage' }))
    })
    const chassis = screen.getByRole('button', { name: /^Mule · T1/ })
    fireEvent.click(chassis)
    // Picking the Chassis uses the band's one pick: every other part waits.
    const others = screen
      .getAllByRole('button', { pressed: false })
      .filter((b) => b.textContent?.includes(' · T'))
    expect(others.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByText('Take to the crawler'))
    })
    expect(settled).toHaveLength(1)
    expect(settled[0]?.(crawler)?.cargoLots?.[0]).toMatchObject({ name: 'Mule (Damaged)' })
  })

  test('a 1 takes nothing, and settles the wreck', async () => {
    const settled: Parameters<PlayMediator['salvageWreck']>[1][] = []
    renderSalvage(1, settled)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Mech Salvage' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Nothing to take: settle it'))
    })
    expect(settled[0]?.(crawler)).toBeNull()
  })

  test('a 2–5 pays half the Chassis in Scrap to the pool', async () => {
    const settled: Parameters<PlayMediator['salvageWreck']>[1][] = []
    renderSalvage(3, settled)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Mech Salvage' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByText(/^Take \d+ Tech 1 Scrap to the crawler$/))
    })
    expect(settled[0]?.(crawler)?.scrapPool?.tl1).toBeGreaterThan(0)
  })

  test('once salvaged, nothing is left to take', () => {
    const npc = { ...downedHauler(), salvaged: true }
    render(
      <PlayWreckSalvage
        npc={npc}
        wreck={wreckOf(npc) as Wreck}
        canWrite
        hasCrawler
        onSettle={async () => undefined}
      />
    )
    expect(screen.getByText('Salvaged: nothing is left to take.')).toBeTruthy()
  })
})
