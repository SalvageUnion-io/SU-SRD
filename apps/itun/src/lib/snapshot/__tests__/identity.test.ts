import { describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { snapshotIdentity } from '../identity'

/**
 * `snapshotIdentity` reads which entity a retired snapshot names (ADR-036),
 * from either the stored blob or the Worker's `{ kind, appId }` answer. The
 * input is untrusted both ways, so everything that is not one of those two
 * shapes, exactly, is null.
 */
describe('snapshotIdentity', () => {
  test('reads a stored snapshot: kind, and the entity id as the app id', () => {
    const stored = { kind: 'pilot', entity: pilotFixture({ id: 'p-app-1' }) }
    expect(snapshotIdentity(stored)).toEqual({ kind: 'pilot', appId: 'p-app-1' })
  })

  test('reads the identity answer itself', () => {
    expect(snapshotIdentity({ kind: 'crawler', appId: 'c-9' })).toEqual({
      kind: 'crawler',
      appId: 'c-9',
    })
  })

  test('returns only kind and appId — never the rest of the blob', () => {
    const stored = {
      kind: 'mech',
      entity: { id: 'm-1', name: 'Iron Jaw' },
      context: { pilotAbilities: ['beefcake'] },
    }
    expect(Object.keys(snapshotIdentity(stored) ?? {}).sort()).toEqual(['appId', 'kind'])
  })

  test.each([
    ['null', null],
    ['a string', 'pilot'],
    ['an array', [{ kind: 'pilot', appId: 'p' }]],
    ['no kind', { entity: { id: 'p-1' } }],
    ['a kind that is not a sheet', { kind: 'encounterNpc', entity: { id: 'n-1' } }],
    ['no entity and no appId', { kind: 'pilot' }],
    ['an entity with no id', { kind: 'pilot', entity: { name: 'No id' } }],
    ['an empty id', { kind: 'pilot', appId: '' }],
    ['a non-string id', { kind: 'pilot', entity: { id: 42 } }],
    ['an absurdly long id', { kind: 'pilot', appId: 'x'.repeat(129) }],
  ])('null for %s', (_label, value) => {
    expect(snapshotIdentity(value)).toBeNull()
  })
})
