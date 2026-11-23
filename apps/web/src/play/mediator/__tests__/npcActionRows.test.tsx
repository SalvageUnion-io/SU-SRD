/**
 * An Opposition unit's action rows, before Use is pressed: a weapon shows its
 * range, damage and traits (r5 B8), and a chassis ability names its chassis
 * where the book's text holds a placeholder (r5 B9; the data is unchanged).
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { rollForTable } from '../../../components/index'
import { npcActions } from '../npcActions.model'
import { newTrayNpc, readTrayNpc } from '../opposition.model'
import { PlayNpcActions } from '../PlayNpcActions'
import { hitDamageOf } from '../proposalLine.model'

function scrapper() {
  const chassis = SalvageUnionReference.Chassis.getByName('Scrapper')
  const pattern = chassis?.patterns?.[0]
  if (chassis === undefined || pattern === undefined) throw new Error('no Scrapper pattern')
  const body = newTrayNpc('chassis', chassis, [], '2026-11-22T00:00:00.000Z', { pattern })
  return readTrayNpc({ _id: 'n1', body })
}

function scrapperRows() {
  const npc = scrapper()
  const { container } = render(<PlayNpcActions npc={npc} canWrite onMorale={() => {}} />)
  return [...container.querySelectorAll('li.su-play-act')].map((li) => li.textContent ?? '')
}

describe('an Opposition unit’s action rows', () => {
  test('a weapon with no effect text still shows its traits before Use (r5 B8)', () => {
    const rigging = scrapperRows().find((row) => row.startsWith('Rigging Arm'))
    // Its Range chip and its trait, past the name.
    expect(rigging?.replace('Rigging Arm', '')).toContain('RNG')
    expect(rigging?.replace('Rigging Arm', '')).toContain('Rigging')
  })

  test('a chassis ability reads its chassis’s name, never the placeholder (r5 B9)', () => {
    const rows = scrapperRows()
    expect(rows.some((row) => row.includes('[(CHASSIS)]'))).toBe(false)
    expect(rows.some((row) => row.includes('Scrapper suffers no effect'))).toBe(true)
  })
})

const dice =
  (die: number): typeof rollForTable =>
  async () =>
  () =>
    die

async function useAndRoll(name: string, name2: string) {
  fireEvent.click(screen.getByRole('button', { name: `Use ${name} for ${name2}` }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die on NPC Action' }))
  })
}

describe('an NPC action, rolled (r8 B5)', () => {
  test('one with no hit to offer folds once its die is rolled', async () => {
    const npc = scrapper()
    const plain = npcActions(npc).find((a) => hitDamageOf(a.action) === null)
    if (plain === undefined) throw new Error('no action without damage')
    render(<PlayNpcActions npc={npc} canWrite onMorale={() => {}} rollFor={dice(14)} />)
    await useAndRoll(plain.name, npc.name)
    expect(screen.queryByRole('button', { name: 'Roll the die on NPC Action' })).toBeNull()
  })

  test('a hit keeps it open without a second roll, and folds once proposed', async () => {
    const npc = scrapper()
    const weapon = npcActions(npc).find((a) => hitDamageOf(a.action) !== null)
    if (weapon === undefined) throw new Error('no weapon')
    const targets = [
      {
        id: 'p1',
        kind: 'pilot' as const,
        label: 'Bonesaw',
        pilotLinkId: 'l1',
        readings: { currentHP: { current: 10, max: 10 } },
      },
      {
        id: 'm1',
        kind: 'mech' as const,
        label: "Bonesaw's Scrapper",
        pilotLinkId: 'l1',
        readings: { currentSP: { current: 10, max: 10 } },
      },
    ]
    const sent: unknown[] = []
    render(
      <PlayNpcActions
        npc={npc}
        canWrite
        onMorale={() => {}}
        rollFor={dice(14)}
        hit={{ targets, onPropose: async (args) => void sent.push(args) }}
      />
    )
    await useAndRoll(weapon.name, npc.name)
    // The result stands with its hit, and the roll only reads.
    const stamp = screen.queryByRole('button', { name: 'Roll the die on NPC Action' })
    expect(stamp === null || stamp.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Propose \d+ (HP|SP) from/ }))
    await act(async () => {
      fireEvent.click(screen.getAllByRole('menuitem', { name: /Bonesaw/ })[0] as HTMLElement)
    })
    expect(sent.length).toBe(1)
    expect(
      screen.queryByRole('button', { name: `Cancel ${weapon.name} for ${npc.name}` })
    ).toBeNull()
  })
})
