import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'

/**
 * `PlayResolveSteps` offline (r6 A14): the resolve's own roll still rolls,
 * its steps held "Not sent yet" (`useSeatAt`); a Push, which writes the
 * table, waits for the connection and says so.
 */

import { hydrateStores } from '../../components/__tests__/hydrateStores'
import { playCopy } from '../../messages/play'
import { SyncContext } from '../../replica/syncContext'
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

function renderOffline(resolve: Resolving) {
  return render(
    <SyncContext.Provider value={{ status: 'offline', canWrite: false, outdated: false }}>
      <PlayResolveSteps view={resolve} canWrite={false} />
    </SyncContext.Provider>
  )
}

const ROLL = { name: 'Roll the die on Core Mechanic' }

describe('offline, the resolve goes on (r6 A14)', () => {
  test('the roll rolls, and a held step reads Not sent yet', () => {
    const onRoll = mock(() => undefined)
    renderOffline(view({ held: true }, { onRoll }))
    fireEvent.click(screen.getByRole('button', ROLL))
    expect(onRoll).toHaveBeenCalledTimes(1)
    expect(screen.getByText(playCopy('notSentYet'))).toBeTruthy()
    expect(screen.queryByTitle(playCopy('rollWaitsOffline'))).toBeNull()
  })

  test('a Push waits for the connection, and says so', () => {
    const onPush = mock(() => undefined)
    const roll = {
      roll: 8,
      band: 'failure',
      bandRange: '6–10',
      bandLabel: 'Failure',
      bandSummary: '',
      destructive: false,
    }
    renderOffline(view({ roll }, { push: { disabled: false, pushed: false, heat: 2, onPush } }))
    expect(screen.queryByText(playCopy('notSentYet'))).toBeNull()
    const push = screen.getByTitle(playCopy('rollWaitsOffline')) as HTMLButtonElement
    expect(push.disabled).toBe(true)
    fireEvent.click(push)
    expect(onPush).not.toHaveBeenCalled()
  })
})
