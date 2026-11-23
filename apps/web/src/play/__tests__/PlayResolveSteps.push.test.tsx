import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'

/**
 * A Push after the roll (r7 B1): after a Success it is a quiet text button,
 * never the stamp the next press lands on; after a Failure it is the stamp.
 * Either way it says the Heat it adds.
 */

import { hydrateStores } from '../../components/__tests__/hydrateStores'
import type { ResolveModel } from '../actionsDeck.model'
import { PlayResolveSteps } from '../PlayResolveSteps'

beforeAll(hydrateStores)

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

function view(over: Partial<Resolving> = {}, controls: Partial<Resolving['controls']> = {}) {
  const resolve: Resolving = {
    kind: 'resolve',
    onBack: () => undefined,
    cost: { amount: 0, heat: 0, uses: 0 },
    free: true,
    rollLeads: false,
    rollSpends: null,
    currency: 'AP',
    controls: {
      activateDisabled: false,
      onActivate: () => undefined,
      onRoll: () => undefined,
      activated: true,
      applyLabel: 'Apply',
      applyDisabled: true,
      onApply: () => undefined,
      onClear: () => undefined,
      ...controls,
    },
    roll: null,
    applied: false,
    applyRouted: false,
    nothingToApply: false,
    closesItself: null,
    progressed: false,
    held: false,
    ...over,
  }
  return resolve
}

function rolled(band: string, onPush: () => void) {
  return view(
    {
      roll: {
        roll: band === 'success' ? 15 : 3,
        band,
        bandRange: '',
        bandLabel: band,
        bandSummary: '',
        destructive: false,
      },
      nothingToApply: true,
    },
    { push: { disabled: false, pushed: false, heat: 2, onPush } }
  )
}

describe('Push after the roll (r7 B1)', () => {
  test('after a Success it is a quiet button, not the stamp', () => {
    const onPush = mock(() => undefined)
    render(<PlayResolveSteps view={rolled('success', onPush)} canWrite />)
    expect(screen.queryByRole('button', { name: /on Core Mechanic/ })).toBeNull()
    const push = screen.getByRole('button', { name: 'Push · +2 Heat' })
    expect(push.className).toContain('ghost')
    fireEvent.click(push)
    expect(onPush).toHaveBeenCalledTimes(1)
  })

  test('after a Failure the stamp is Push, and says its Heat', () => {
    const onPush = mock(() => undefined)
    render(<PlayResolveSteps view={rolled('failure', onPush)} canWrite />)
    expect(screen.queryByRole('button', { name: 'Push · +2 Heat' })).toBeNull()
    const stamp = screen.getByRole('button', { name: 'Push · +2 heat on Core Mechanic' })
    expect(stamp.className).toContain('primary')
  })
})
