/**
 * The unit boxes' write path (play.md §4): on a live unit each − / + (and
 * the gauge's own slider) is one `entityStore.update` with the patch the
 * sheet writes for that vital, tagged as Play's transaction; a reference
 * unit offers no control that writes at all.
 *
 * The boxes take an injected store (`makeEntityStoreMock`), which records
 * every update. Which unit is live is the column's, in
 * `PlayUnitsColumn.test.tsx`.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { crawlerFixture, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { hydrateStores } from '../../components/__tests__/hydrateStores'
import { makeEntityStoreMock } from '../../components/__tests__/mockEntityStore'
import type { ChangeMeta, EntityType } from '../../stores/entityStore'
import { PLAY_TXN } from '../../stores/surfaceProvenance'
import { PlayCrawlerUnit, PlayHangarMech, PlayMechUnit, PlayPilotUnit } from '../PlayUnits'

type Update = { type: EntityType; id: string; patch: Record<string, unknown>; meta?: ChangeMeta }

function recordingStore() {
  const updates: Update[] = []
  const store = makeEntityStoreMock({
    update: async (type, id, patch, meta) => {
      updates.push({ type, id, patch: patch as Record<string, unknown>, meta })
      return null
    },
  })
  return { store, updates }
}

beforeAll(async () => {
  await hydrateStores()
})

const pilot = pilotFixture({ id: 'w-pilot', name: 'Bonesaw', currentHP: 7, currentAP: 3 })
const mech = mechFixture({
  id: 'w-mech',
  name: 'Buzzard',
  chassisRef: 'mule',
  currentSP: 5,
  currentEP: 2,
  currentHeat: 3,
})

describe('a live pilot', () => {
  test('− / + on HP and AP write currentHP / currentAP, as the sheet does', () => {
    const { store, updates } = recordingStore()
    render(<PlayPilotUnit pilot={pilot} crawler={null} live store={store} />)
    fireEvent.click(screen.getByRole('button', { name: 'HP −1' }))
    fireEvent.click(screen.getByRole('button', { name: 'AP +1' }))
    expect(updates).toEqual([
      { type: 'pilot', id: 'w-pilot', patch: { currentHP: 6 }, meta: PLAY_TXN },
      { type: 'pilot', id: 'w-pilot', patch: { currentAP: 4 }, meta: PLAY_TXN },
    ])
  })

  test('the gauge is a slider too: an arrow key is the same write', () => {
    const { store, updates } = recordingStore()
    render(<PlayPilotUnit pilot={pilot} crawler={null} live store={store} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'HP' }), { key: 'ArrowRight' })
    expect(updates.map((u) => u.patch)).toEqual([{ currentHP: 8 }])
  })

  test('its class, TP and injuries are chips', () => {
    const { store } = recordingStore()
    render(
      <PlayPilotUnit
        pilot={{
          ...pilot,
          trainingPoints: 2,
          injuries: [{ severity: 'minor', note: 'cracked rib' }],
        }}
        crawler={null}
        live
        store={store}
      />
    )
    expect(screen.getByText('TP')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('Minor injury: cracked rib')).toBeTruthy()
    expect(screen.queryByText('No injuries')).toBeNull()
  })
})

describe('a boarded mech', () => {
  test('SP, EP and Heat write currentSP, currentEP and currentHeat', () => {
    const { store, updates } = recordingStore()
    render(<PlayMechUnit mech={mech} place="boarded" live range="Close" store={store} />)
    fireEvent.click(screen.getByRole('button', { name: 'SP +1' }))
    fireEvent.click(screen.getByRole('button', { name: 'EP −1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Heat −1' }))
    expect(updates).toEqual([
      { type: 'mech', id: 'w-mech', patch: { currentSP: 6 }, meta: PLAY_TXN },
      { type: 'mech', id: 'w-mech', patch: { currentEP: 1 }, meta: PLAY_TXN },
      { type: 'mech', id: 'w-mech', patch: { currentHeat: 2 }, meta: PLAY_TXN },
    ])
  })

  test('+ stops at the max and − at 0', () => {
    const { store } = recordingStore()
    render(
      <PlayMechUnit
        mech={{ ...mech, currentSP: 12, currentHeat: 0 }}
        place="boarded"
        live
        store={store}
      />
    )
    expect(screen.getByRole('button', { name: 'SP +1' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Heat −1' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('activated effects (ADR-029 §4)', () => {
  const magnetised = { ...mech, modules: ['hull-magnetiser'] }
  const effect = () => screen.getByRole('button', { name: /hull magnetiser/i })

  test('boarded and live, each effect is a toggle that switches it on the seat', () => {
    const toggled: string[] = []
    render(
      <PlayMechUnit
        mech={magnetised}
        place="boarded"
        live
        onToggleEffect={(ref) => toggled.push(ref)}
      />
    )
    expect(screen.getByRole('group', { name: 'Effects of Buzzard' })).toBeTruthy()
    expect(effect().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(effect())
    expect(toggled).toEqual(['hull-magnetiser'])
  })

  test('an effect the seat has on reads pressed', () => {
    render(
      <PlayMechUnit
        mech={magnetised}
        place="boarded"
        live
        activeEffects={['hull-magnetiser']}
        onToggleEffect={() => undefined}
      />
    )
    expect(effect().getAttribute('aria-pressed')).toBe('true')
  })

  test('read only, the toggles show but cannot be pressed', () => {
    render(<PlayMechUnit mech={magnetised} place="boarded" live={false} />)
    expect(effect().hasAttribute('disabled')).toBe(true)
  })

  test('a parked mech has no effects to switch', () => {
    render(<PlayMechUnit mech={magnetised} place="parked" live={false} onBoard={() => undefined} />)
    expect(screen.queryByRole('group', { name: 'Effects of Buzzard' })).toBeNull()
  })
})

describe('a reference unit cannot be edited', () => {
  test('a parked mech: read-outs only, and Board is its one control', () => {
    const { store, updates } = recordingStore()
    const boards: string[] = []
    render(
      <PlayMechUnit
        mech={mech}
        place="parked"
        live={false}
        onBoard={() => boards.push(mech.id)}
        store={store}
      />
    )
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('img', { name: 'SP 5 of 12' })).toBeTruthy()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Board'])
    fireEvent.click(screen.getByRole('button', { name: 'Board Buzzard' }))
    expect(boards).toEqual(['w-mech'])
    expect(updates).toEqual([])
  })

  test('a mech that cannot be boarded from here: Board is there, and off', () => {
    const { store } = recordingStore()
    render(<PlayMechUnit mech={mech} place="parked" live={false} onBoard={null} store={store} />)
    expect(screen.getByRole('button', { name: 'Board Buzzard' }).hasAttribute('disabled')).toBe(
      true
    )
  })

  test('a read-only pilot and crawler offer nothing that writes', () => {
    const { store, updates } = recordingStore()
    render(
      <>
        <PlayPilotUnit pilot={pilot} crawler={null} live={false} store={store} />
        <PlayCrawlerUnit
          crawler={crawlerFixture({ id: 'w-crawler', name: 'Tenacity', currentSP: 10 })}
          live={false}
          downtime={false}
          store={store}
        />
      </>
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByText('Read only')).toBeTruthy()
    expect(updates).toEqual([])
  })
})

describe('a live crawler', () => {
  test('− / + on SP write currentSP', () => {
    const { store, updates } = recordingStore()
    render(
      <PlayCrawlerUnit
        crawler={crawlerFixture({ id: 'w-crawler', name: 'Tenacity', currentSP: 10 })}
        live
        downtime
        store={store}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'SP −1' }))
    expect(updates).toEqual([
      { type: 'crawler', id: 'w-crawler', patch: { currentSP: 9 }, meta: PLAY_TXN },
    ])
  })
})

describe('the Downtime restore preview', () => {
  test('each vital the step changes reads "→ N" (ArrowRight, R23) after its gauge, still showing now', () => {
    const { store } = recordingStore()
    render(
      <PlayMechUnit
        mech={mech}
        place="downtime"
        live={false}
        restore={{ sp: 12, heat: 0 }}
        store={store}
      />
    )
    expect(screen.getByRole('img', { name: 'SP 5 of 12' })).toBeTruthy()
    const note = screen.getByRole('note', { name: 'SP restores to 12' })
    expect(note.textContent?.trim()).toBe('12')
    expect(note.querySelector('svg')).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Heat restores to 0' })).toBeTruthy()
    expect(screen.queryByRole('note', { name: /^EP/ })).toBeNull()
    expect(screen.getByText('Mech Bay')).toBeTruthy()
  })
})

describe('a hangar mech', () => {
  test('a Token with its chassis and where it is', () => {
    const { container } = render(<PlayHangarMech name="Old Faithful" chassis="Mule" note={null} />)
    expect(container.querySelector('.su-entity-token')).not.toBeNull()
    expect(container.textContent).toContain('Old Faithful')
    // Where it is, a state chip in the Token's chip group (C8), never loose words.
    const state = container.querySelector(
      ".su-entity-token__chips [data-chip-class='state'] .su-stat-cell"
    )
    expect(state?.textContent).toBe('In hangar')
  })

  test('a destroyed one says so in place of "In hangar"', () => {
    const { container } = render(<PlayHangarMech name="Wreck" chassis={null} note="Destroyed" />)
    expect(container.querySelector('.su-entity-token__chips')?.textContent).toBe('Destroyed')
    expect(container.textContent).not.toContain('In hangar')
  })
})
