/**
 * PartnerCard — a partner's SP / EP / Heat as the mech's `SheetVitalGauge`s:
 * a max pins with an `override` write, a pinned max shows its derivation and
 * reverts to it, typing the derived value back in writes no pin, and Read
 * offers none of it.
 *
 * Sestra Drone (Little Sestra, Surveyor) derives SP 7 / EP 8 / Heat 6.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { mechPartnerSeeds, syncPartners } from '../../../lib/rules/partnerGrants'
import type { ChangeMeta } from '../../../replica/provenance'
import { PartnerCard } from '../PartnerCard'

type UpdateCall = [string, string, { partners?: PartnerInstance[] }, ChangeMeta]

function sestra(over: Partial<PartnerInstance> = {}): { mech: Mech; partner: PartnerInstance } {
  const seeded = must(
    syncPartners(undefined, mechPartnerSeeds('little-sestra', 'Surveyor'), { reseedLoadout: true })
  )
  const partner = { ...must(seeded[0]), ...over }
  const mech = mechFixture({
    id: 'mech-sestra',
    chassisRef: 'little-sestra',
    patternName: 'Surveyor',
    partners: [partner],
  })
  return { mech, partner }
}

function renderCard(over: Partial<PartnerInstance> = {}, readOnly = false) {
  const { mech, partner } = sestra(over)
  const update = mock(async () => mech)
  const store = makeSingleUnitStore('mech', mech, { update })
  render(
    <PartnerCard
      found={{ partner, hostKind: 'mech', host: mech }}
      store={store}
      readOnly={readOnly}
    />
  )
  const calls = () => update.mock.calls as unknown as UpdateCall[]
  const written = () => must(calls().at(-1)?.[2].partners?.[0])
  return { calls, written }
}

function setMax(vital: 'SP' | 'EP' | 'Heat', next: number): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`override ${vital} max`, 'i') }))
  const input = screen.getByLabelText(`Set ${vital} max`)
  fireEvent.change(input, { target: { value: String(next) } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('PartnerCard — vitals max override', () => {
  test('pinning a max writes the pin through the host as an override', () => {
    const { calls, written } = renderCard()
    setMax('SP', 10)
    expect(calls()).toHaveLength(1)
    expect(written().maxSpOverride).toBe(10)
    expect(calls()[0]?.[3].kind).toBe('override')
  })

  test('a pinned max reads as overridden from its derivation, and reverts', () => {
    const { calls, written } = renderCard({ maxEpOverride: 12 })
    expect(screen.getByText(/overridden from 8/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /revert ep max to derived 8/i }))
    expect(written().maxEpOverride).toBeUndefined()
    expect(calls()[0]?.[3].kind).toBe('override')
  })

  test('typing the derived value back in writes no pin', () => {
    const { calls } = renderCard()
    setMax('Heat', 6)
    expect(calls()).toHaveLength(0)
  })

  test('Read draws the gauges with no override control', () => {
    renderCard({ maxSpOverride: 10 }, true)
    expect(document.querySelector('[data-vital="sp"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /override sp max/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /revert sp max/i })).toBeNull()
  })
})
