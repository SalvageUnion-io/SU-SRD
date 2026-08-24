/**
 * Publish-time payload validation.
 *
 * The case that motivated this file is `rejects {}` below: before validation,
 * an empty object minted a real snapshot id and a real share URL, and the
 * failure only surfaced when a reader opened the link.
 *
 * The happy-path cases deliberately use the shared entity fixtures rather than
 * hand-written literals, so "valid" means the same thing here as everywhere
 * else in the suite — and so a schema change breaks this file rather than
 * quietly loosening what publish accepts.
 */

import { describe, expect, it } from 'bun:test'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { validateSnapshotPayload } from '../payload'

const pilot = pilotFixture({ id: 'p1' })
const mech = mechFixture({ id: 'm1' })
const crawler = crawlerFixture({ id: 'c1' })

describe('validateSnapshotPayload — the envelope', () => {
  it('rejects {} — the gap this exists to close', () => {
    const result = validateSnapshotPayload({})
    expect(result.ok).toBe(false)
    // The entity is checked before the kind, so an empty object is reported as
    // a missing entity rather than an unknown kind. Either is a refusal; this
    // pins which one, so the message a client developer sees is not incidental.
    expect(result.ok === false && result.reason).toContain('Entity data is missing')
  })

  it('rejects null', () => {
    expect(validateSnapshotPayload(null).ok).toBe(false)
  })

  it('rejects an array', () => {
    const result = validateSnapshotPayload([1, 2, 3])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('must be a JSON object')
  })

  it('rejects a bare string', () => {
    expect(validateSnapshotPayload('pilot').ok).toBe(false)
  })

  it('rejects a kind the renderer does not know', () => {
    const result = validateSnapshotPayload({ kind: 'drone', entity: pilot })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('Unknown entity kind')
  })

  it('rejects a known kind with a missing entity', () => {
    const result = validateSnapshotPayload({ kind: 'pilot' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('Entity data is missing')
  })

  it('rejects a known kind whose entity does not satisfy its schema', () => {
    const result = validateSnapshotPayload({ kind: 'pilot', entity: { nonsense: true } })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('Invalid pilot data')
  })

  it('rejects an entity valid for a DIFFERENT kind than the one declared', () => {
    // A crawler body under kind: 'pilot'. Both are real entities, so this only
    // fails if the kind and the body are checked against each other.
    const result = validateSnapshotPayload({ kind: 'pilot', entity: crawler })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('Invalid pilot data')
  })
})

describe('validateSnapshotPayload — the three kinds', () => {
  it('accepts a valid pilot', () => {
    expect(validateSnapshotPayload({ kind: 'pilot', entity: pilot }).ok).toBe(true)
  })

  it('accepts a valid mech', () => {
    expect(validateSnapshotPayload({ kind: 'mech', entity: mech }).ok).toBe(true)
  })

  it('accepts a valid crawler', () => {
    expect(validateSnapshotPayload({ kind: 'crawler', entity: crawler }).ok).toBe(true)
  })
})

describe('validateSnapshotPayload — context', () => {
  it('accepts a payload with no context (the v1 shape)', () => {
    expect(validateSnapshotPayload({ kind: 'pilot', entity: pilot }).ok).toBe(true)
  })

  it('accepts a well-formed context', () => {
    const result = validateSnapshotPayload({
      kind: 'mech',
      entity: mech,
      context: { pilotAbilities: ['beefcake'] },
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a context object with no pilotAbilities', () => {
    expect(validateSnapshotPayload({ kind: 'mech', entity: mech, context: {} }).ok).toBe(true)
  })

  it('rejects a non-object context', () => {
    const result = validateSnapshotPayload({ kind: 'mech', entity: mech, context: 'beefcake' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('context must be a JSON object')
  })

  it('rejects pilotAbilities that is not an array', () => {
    const result = validateSnapshotPayload({
      kind: 'mech',
      entity: mech,
      context: { pilotAbilities: 'beefcake' },
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('array of strings')
  })

  it('rejects pilotAbilities holding a non-string', () => {
    const result = validateSnapshotPayload({
      kind: 'mech',
      entity: mech,
      context: { pilotAbilities: ['beefcake', 7] },
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('array of strings')
  })
})

describe('validateSnapshotPayload — forward compatibility', () => {
  it('ALLOWS an unknown top-level key', () => {
    // `context` itself was added additively to the v1 `{ kind, entity }` shape.
    // Refusing unknown keys would mean an already-deployed Worker rejecting the
    // next such addition — see the module header.
    const result = validateSnapshotPayload({
      kind: 'pilot',
      entity: pilot,
      publishedBy: 'some-future-field',
    })
    expect(result.ok).toBe(true)
  })
})
