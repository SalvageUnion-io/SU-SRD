/**
 * ExoticTrade — the Trading Bay's trade of Bio-Salvage, Chimerium and Meld
 * Nanites for Scrap (`tradeExotic`): one Scrap of the resource's trade Tech
 * Level a piece, written as a Live-Sheet transaction.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import type { ChangeMeta } from '../../../replica/provenance'
import { LIVE_SHEET_TXN } from '../../../replica/provenance'
import { ExoticTrade } from '../ExoticTrade'

function setup(scrapPool: Crawler['scrapPool']) {
  const crawler = crawlerFixture({ id: 'c', name: 'Tenacity', techLevel: 'tech-2', scrapPool })
  const update = mock<
    (type: string, id: string, patch: Partial<Crawler>, meta?: ChangeMeta) => Promise<Crawler>
  >(async () => crawler)
  const store = makeSingleUnitStore('crawler', crawler, { update })
  render(<ExoticTrade crawler={crawler} store={store} />)
  return { update }
}

describe('ExoticTrade', () => {
  test('renders nothing while the pool holds none of the four', () => {
    setup({ tl2: 4 })
    expect(screen.queryByText('Trade Bio-Salvage & Nanites')).toBeNull()
  })

  test('trades the first held resource for Scrap of its Tech Level', async () => {
    const { update } = setup({ bio: 3, chimerium: 1 })
    expect(screen.getByTestId('exotic-trade-preview').textContent).toBe('1× Bio-Salvage → 1× T1')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Trade' }))
    })
    const call = update.mock.calls.at(-1)
    expect(call?.[2]).toEqual({ scrapPool: { bio: 2, chimerium: 1, tl1: 1 } })
    expect(call?.[3]).toEqual(LIVE_SHEET_TXN)
    expect(screen.getByRole('status').textContent).toBe('Traded 1× Bio-Salvage for 1× T1.')
  })

  test('picking Chimerium trades it as Tech 6', async () => {
    const { update } = setup({ bio: 3, chimerium: 2 })
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Resource'), { target: { value: 'chimerium' } })
    })
    expect(screen.getByTestId('exotic-trade-preview').textContent).toBe('1× Chimerium → 1× T6')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Trade' }))
    })
    expect(update.mock.calls.at(-1)?.[2]).toEqual({ scrapPool: { bio: 3, chimerium: 1, tl6: 1 } })
  })
})
